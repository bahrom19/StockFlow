import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JournalEntryStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { JournalEntriesRepository } from '../repositories/journal-entries.repository';
import { PostingValidationService } from './posting-validation.service';
import { JournalPostedEvent } from '../events/journal-posted.event';

export interface PostJournalEntryInput {
  companyId: string;
  financialPeriodId: string;
  entryDate: Date;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  createdBy: string;
  lines: Array<{
    accountId: string;
    debit: string;
    credit: string;
    description?: string;
  }>;
}

export interface ReversalResult {
  originalEntryId: string;
  reversalEntryId: string;
  isReversal: true;
}

/**
 * Core General Ledger Engine.
 *
 * Features:
 * - Immutable posting — posted entries are never updated, only reversed
 * - Posting validation pipeline — validates period, debits/credits, accounts
 * - Reversal entries — reverses a posted entry by negating debits/credits
 * - Account balance snapshot updates — real-time balance tracking
 * - Event-driven — publishes journal.posted on every successful posting
 * - Transaction-safe — all operations inside Prisma.$transaction
 */
@Injectable()
export class GlEngineService {
  private readonly logger = new Logger(GlEngineService.name);

  constructor(
    private readonly journalRepository: JournalEntriesRepository,
    private readonly validationService: PostingValidationService,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  /**
   * Create and post a journal entry in a single atomic transaction.
   * This is the primary entry point for all journal postings.
   *
   * Validation pipeline:
   * 1. Financial period is OPEN
   * 2. Entry date is within period
   * 3. At least 2 lines
   * 4. All accounts exist, active, belong to company
   * 5. Debit == Credit
   * 6. No negative amounts
   */
  async post(
    input: PostJournalEntryInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    id: string;
    entryNumber: number;
    status: string;
    totalDebit: string;
    totalCredit: string;
  }> {
    const executePost = async (transactionClient: Prisma.TransactionClient) => {
      // Step 1: Validate
      const { totalDebit, totalCredit } = await this.validationService.validate(
        {
          companyId: input.companyId,
          entryDate: input.entryDate,
          financialPeriodId: input.financialPeriodId,
          lines: input.lines,
        },
        transactionClient,
      );

      // Step 2: Generate next entry number
      const entryNumber =
        await this.journalRepository.getNextEntryNumberInTransaction(
          transactionClient,
          input.companyId,
          input.financialPeriodId,
        );

      // Step 3: Create the journal entry as POSTED (immutable)
      const entry = await this.journalRepository.createInTransaction(
        transactionClient,
        {
          entryNumber,
          entryDate: input.entryDate,
          description: input.description ?? null,
          status: JournalEntryStatus.POSTED,
          totalDebit: totalDebit.toString(),
          totalCredit: totalCredit.toString(),
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          companyId: input.companyId,
          financialPeriodId: input.financialPeriodId,
          createdBy: input.createdBy,
          lines: input.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit || '0',
            credit: l.credit || '0',
            description: l.description ?? null,
          })),
        },
      );

      // Step 4: Update posted fields
      const posted = await transactionClient.journalEntry.update({
        where: { id: entry.id },
        data: {
          postedBy: input.createdBy,
          postedAt: new Date(),
        },
      });

      // Step 5: Update account balance snapshots
      await this.updateAccountBalances(
        input.companyId,
        input.financialPeriodId,
        entry.entryDate,
        input.lines,
        transactionClient,
      );

      // Step 6: Audit log
      await this.auditLog.log(
        {
          companyId: input.companyId,
          userId: input.createdBy,
          entityType: 'JournalEntry',
          entityId: entry.id,
          action: 'POST',
          before: null,
          after: {
            entryNumber,
            totalDebit: totalDebit.toString(),
            totalCredit: totalCredit.toString(),
            linesCount: input.lines.length,
          },
        },
        transactionClient,
      );

      // Step 7: Publish journal.posted event
      try {
        await this.eventBus.publish(
          new JournalPostedEvent({
            journalEntryId: entry.id,
            companyId: input.companyId,
            financialPeriodId: input.financialPeriodId,
            entryNumber,
            entryDate: input.entryDate,
            description: input.description ?? null,
            totalDebit: totalDebit.toString(),
            totalCredit: totalCredit.toString(),
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            postedBy: input.createdBy,
            postedAt: new Date(),
            lines: (entry.lines ?? []).map((l) => ({
              id: l.id,
              accountId: l.accountId,
              debit: l.debit.toString(),
              credit: l.credit.toString(),
              description: l.description,
            })),
          }),
          { context: { transactionClient } },
        );
      } catch (err) {
        this.logger.warn(
          `Failed to publish journal.posted: ${(err as Error).message}`,
        );
      }

      return {
        id: entry.id,
        entryNumber: posted.entryNumber,
        status: posted.status,
        totalDebit: posted.totalDebit.toString(),
        totalCredit: posted.totalCredit.toString(),
      };
    };

    // If a transaction client is provided, use it directly (no nested transaction).
    // Otherwise, create a new transaction.
    if (tx) {
      return executePost(tx);
    }
    return this.prismaService.$transaction((transactionClient) =>
      executePost(transactionClient),
    );
  }

  /**
   * Create a reversal entry for a previously posted journal entry.
   *
   * Automatically negates all debit/credit amounts and links
   * the reversal to the original entry via referenceType/referenceId.
   *
   * @throws BadRequestException if the entry is not POSTED
   * @throws NotFoundException if the entry doesn't exist
   */
  async reverse(
    originalEntryId: string,
    companyId: string,
    reversedBy: string,
    reason?: string,
  ): Promise<ReversalResult> {
    return this.prismaService.$transaction(async (tx) => {
      // Find the original entry
      const original = await this.journalRepository.findById(
        originalEntryId,
        companyId,
        tx,
      );
      if (!original) {
        throw new NotFoundException(
          `Journal entry ${originalEntryId} not found`,
        );
      }
      if (original.status !== JournalEntryStatus.POSTED) {
        throw new NotFoundException(
          `Only POSTED entries can be reversed. Entry ${originalEntryId} is "${original.status}".`,
        );
      }

      // Mark original as REVERSED
      await tx.journalEntry.update({
        where: { id: originalEntryId },
        data: {
          status: JournalEntryStatus.REVERSED,
          rowVersion: { increment: 1 },
        },
      });

      // Create reversal entry — negate all debits/credits
      const reversalLines = (original.lines ?? []).map((line) => ({
        accountId: line.accountId,
        debit: line.credit.toString(),
        credit: line.debit.toString(),
        description: `REVERSAL: ${reason || `Reversal of entry #${original.entryNumber}`}`,
      }));

      // Use the post pipeline to create the reversal as a new POSTED entry
      // Pass the SAME transaction client so everything commits together
      const reversalInput: PostJournalEntryInput = {
        companyId,
        financialPeriodId: original.financialPeriodId,
        entryDate: new Date(),
        description: `Reversal of entry #${original.entryNumber}: ${reason || 'manual reversal'}`,
        referenceType: 'REVERSAL',
        referenceId: originalEntryId,
        createdBy: reversedBy,
        lines: reversalLines,
      };

      const result = await this.post(reversalInput, tx);

      // Audit log the reversal
      await this.auditLog.log(
        {
          companyId,
          userId: reversedBy,
          entityType: 'JournalEntry',
          entityId: originalEntryId,
          action: 'REVERSED',
          before: { status: 'POSTED' },
          after: { status: 'REVERSED', reversalEntryId: result.id },
        },
        tx,
      );

      return {
        originalEntryId,
        reversalEntryId: result.id,
        isReversal: true,
      };
    });
  }

  /**
   * Update account balance snapshots after a journal entry is posted.
   *
   * Creates or updates AccountBalance records for each account
   * affected by the journal entry. This enables fast account statement
   * and trial balance queries without scanning millions of journal lines.
   */
  private async updateAccountBalances(
    companyId: string,
    financialPeriodId: string,
    entryDate: Date,
    lines: Array<{ accountId: string; debit: string; credit: string }>,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth() + 1;

    for (const line of lines) {
      const debit = new Decimal(line.debit || '0');
      const credit = new Decimal(line.credit || '0');

      // M1: atomic upsert on the compound unique (companyId, accountId,
      // financialPeriodId). The previous findFirst + create() was a
      // check-then-act race: two concurrent postings for a NEW account+period
      // both observed "no balance" and both called create(), the second hitting
      // P2002 (unique violation) which surfaced as HTTP 400/500. Upsert is a
      // single atomic statement — the create branch initializes the snapshot,
      // the update branch atomically increments the running totals. No lost
      // update, no spurious conflict, and accounting stays exact because
      // openingDebit/openingCredit are always 0 and never change, so closing ==
      // opening(0) + cumulative period totals.
      await tx.accountBalance.upsert({
        where: {
          companyId_accountId_financialPeriodId: {
            companyId,
            accountId: line.accountId,
            financialPeriodId,
          },
        },
        create: {
          companyId,
          accountId: line.accountId,
          financialPeriodId,
          year,
          month,
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(0),
          periodDebit: debit,
          periodCredit: credit,
          closingDebit: debit,
          closingCredit: credit,
        },
        update: {
          periodDebit: { increment: debit },
          periodCredit: { increment: credit },
          closingDebit: { increment: debit },
          closingCredit: { increment: credit },
          rowVersion: { increment: 1 },
        },
      });
    }
  }
}
