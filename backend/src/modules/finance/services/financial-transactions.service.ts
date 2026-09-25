import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  FinancialTransactionType,
  Prisma,
  TransactionDirection,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateFinancialTransactionDto } from '../dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from '../dto/update-financial-transaction.dto';
import { FinancialTransactionQueryDto } from '../dto/financial-transaction-query.dto';
import { FinancialTransactionEntity } from '../entities/financial-transaction.entity';
import { FinancialTransactionMapper } from '../mappers/financial-transaction.mapper';
import { FinancialTransactionsRepository } from '../repositories/financial-transactions.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CompaniesService } from '../../companies/services/companies.service';
import { GlEngineService } from './gl-engine.service';
import { FiscalCalendarService } from './fiscal-calendar.service';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import {
  runWithIdempotency,
} from '../../../infrastructure/idempotency/idempotency.helper';
import {
  FT_POSTING_REFERENCE_TYPE,
  FT_REVERSAL_REFERENCE_TYPE,
  claimsSaleRefundOwnership,
  planPosting,
  type PostingLeg,
} from './financial-transaction-posting.policy';

/**
 * Resolves the economic counterpart for a domain-referenced
 * FinancialTransaction (D1 hybrid). C3-A registers no production resolvers:
 * unresolvable counterparts fail closed. Future domains (and tests) register
 * their own resolvers from their modules, preserving the finance ← domain
 * dependency direction (no finance → domain imports).
 */
export type CounterpartResolver = (
  ref: { referenceType: string; referenceId: string },
  ctx: { companyId: string; tx: Prisma.TransactionClient },
) => Promise<{ accountId: string } | null>;

/** Financial fields frozen once a transaction leaves DRAFT. */
const FROZEN_FIELDS = [
  'amount',
  'type',
  'direction',
  'currency',
  'fee',
  'cashAccountId',
  'bankAccountId',
  'destinationBankAccountId',
  'transactionDate',
  // F-AUD-04: domain linkage participates in posting guards (D6) and
  // counterpart resolution, so it freezes with the financial fields instead
  // of being silently dropped.
  'referenceType',
  'referenceId',
] as const;

/** Family fallback GL codes when a register has no linked ChartOfAccount. */
const FAMILY_FALLBACK_CODE = { CASH: '1010', BANK: '1020' } as const;

@Injectable()
export class FinancialTransactionsService {
  private readonly counterpartResolvers = new Map<string, CounterpartResolver>();

  constructor(
    private readonly repository: FinancialTransactionsRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly companiesService: CompaniesService,
    private readonly glEngine: GlEngineService,
    private readonly calendarService: FiscalCalendarService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  /**
   * Register a domain counterpart resolver (D1 hybrid extension point).
   * Called by domain workstreams, never by C3-A itself.
   */
  registerCounterpartResolver(
    referenceType: string,
    resolver: CounterpartResolver,
  ): void {
    this.counterpartResolvers.set(referenceType.toUpperCase(), resolver);
  }

  async create(
    dto: CreateFinancialTransactionDto,
    currentUser: JwtPayload,
    idempotencyKey?: string,
  ): Promise<FinancialTransactionEntity> {
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId: currentUser.companyId,
      idempotencyKey,
      endpoint: 'financial-transactions.create',
      requestHashPayload: { dto, userId: currentUser.userId },
      status: HttpStatus.CREATED,
      work: async (tx) => {
        const fee = dto.fee || '0';
        const netAmount = new Decimal(dto.amount).minus(new Decimal(fee));
        const companyCurrency = await this.companiesService.getBaseCurrency(
          currentUser.companyId,
        );
        if (dto.currency && dto.currency !== companyCurrency) {
          throw new BadRequestException(
            `Currency ${dto.currency} does not match company currency ${companyCurrency}`,
          );
        }

        const data: Prisma.FinancialTransactionCreateInput = {
          type: dto.type as FinancialTransactionType,
          direction: dto.direction as TransactionDirection,
          amount: dto.amount,
          fee: fee,
          netAmount: netAmount.toString(),
          currency: (dto.currency || companyCurrency) as Currency,
          transactionDate: dto.transactionDate || new Date(),
          description: dto.description || null,
          referenceNumber: dto.referenceNumber || null,
          isReconciled: dto.isReconciled ?? false,
          cashAccount: dto.cashAccountId
            ? { connect: { id: dto.cashAccountId } }
            : undefined,
          bankAccount: dto.bankAccountId
            ? { connect: { id: dto.bankAccountId } }
            : undefined,
          destinationBankAccount: dto.destinationBankAccountId
            ? { connect: { id: dto.destinationBankAccountId } }
            : undefined,
          referenceType: dto.referenceType || null,
          referenceId: dto.referenceId || null,
          postingStatus: 'DRAFT',
          idempotencyKey: idempotencyKey || null,
          company: { connect: { id: currentUser.companyId } },
          createdByUser: { connect: { id: currentUser.userId } },
        };

        const created = await this.repository.create(data, tx);
        await this.auditLog.log(
          {
            companyId: currentUser.companyId,
            userId: currentUser.userId,
            entityType: 'FinancialTransaction',
            entityId: created.id,
            action: 'CREATE',
            before: null,
            after: created,
          },
          tx,
        );
        return FinancialTransactionMapper.toEntity(created);
      },
    });
    return result.body as FinancialTransactionEntity;
  }

  /**
   * G15-07-C3-A — explicit posting of a DRAFT FinancialTransaction.
   *
   * Atomic boundary (single caller-owned transaction): CAS-claim
   * DRAFT → POSTED, resolve legs, ensure calendar, resolve the OPEN period
   * covering transactionDate, GlEngine.post(), persist the linkage, audit.
   * Any failure rolls everything back — no orphan FT, no orphan JE.
   */
  async post(
    id: string,
    currentUser: JwtPayload,
    idempotencyKey?: string,
  ): Promise<FinancialTransactionEntity> {
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId: currentUser.companyId,
      idempotencyKey,
      endpoint: 'financial-transactions.post',
      requestHashPayload: { id, userId: currentUser.userId },
      status: HttpStatus.OK,
      work: (tx) => this.applyPost(id, currentUser, tx),
    });
    return result.body as FinancialTransactionEntity;
  }

  private async applyPost(
    id: string,
    currentUser: JwtPayload,
    tx: Prisma.TransactionClient,
  ): Promise<FinancialTransactionEntity> {
    const companyId = currentUser.companyId;
    const ft = await this.repository.findById(id, companyId, tx);
    if (!ft) throw new NotFoundException('Financial transaction not found');
    if (ft.postingStatus !== 'DRAFT') {
      throw new ConflictException(
        `Financial transaction is already ${ft.postingStatus} and cannot be posted again`,
      );
    }

    // Base currency only — never convert implicitly.
    const companyCurrency =
      await this.companiesService.getBaseCurrency(companyId);
    if (ft.currency !== companyCurrency) {
      throw new BadRequestException(
        `Cannot post FinancialTransaction in ${ft.currency}: company base ` +
          `currency is ${companyCurrency}. C3-A supports base currency only.`,
      );
    }

    const amount = new Decimal(ft.amount.toString());
    if (!amount.gt(0)) {
      throw new BadRequestException(
        'Cannot post a FinancialTransaction with a non-positive amount',
      );
    }

    // D6 — sale-linked REFUNDs must flow through the refund domain.
    if (ft.type === 'REFUND') {
      this.assertNotSaleLinked(ft, companyId, await this.saleLinkExists(ft, companyId, tx));
    }

    const hasDomainCounterpart = await this.resolveDomainCounterpartId(
      ft,
      companyId,
      tx,
    );
    const plan = planPosting({
      type: ft.type,
      direction: ft.direction,
      cashAccountId: ft.cashAccountId,
      bankAccountId: ft.bankAccountId,
      destinationBankAccountId: ft.destinationBankAccountId,
      hasDomainCounterpart: hasDomainCounterpart !== null,
    });
    if (!plan.postable) {
      throw new BadRequestException(
        `FinancialTransaction cannot be posted: ${plan.message}`,
      );
    }

    // CAS-claim DRAFT → POSTED before any GL write: exactly one concurrent
    // post can win; the claim rolls back with everything else on failure.
    const claimed = await this.repository.claimPostingStatus(
      id,
      companyId,
      'DRAFT',
      'POSTED',
      ft.rowVersion,
      tx,
    );
    if (claimed === 0) {
      throw new ConflictException(
        'Financial transaction was posted or modified concurrently',
      );
    }

    // Keep the current fiscal calendar provisioned (C0-c invariant), then
    // resolve the OPEN period covering the transaction date. PostingValidation
    // re-checks period membership and OPEN status inside GlEngine.post().
    await this.calendarService.ensureCurrentCalendar(companyId, tx);
    const period = await this.resolveOpenPeriod(
      companyId,
      ft.transactionDate,
      tx,
    );

    const debitAccountId = await this.resolvePlanLeg(
      plan.debit,
      hasDomainCounterpart,
      ft,
      companyId,
      tx,
    );
    const creditAccountId = await this.resolvePlanLeg(
      plan.credit,
      hasDomainCounterpart,
      ft,
      companyId,
      tx,
    );

    const posted = await this.glEngine.post(
      {
        companyId,
        financialPeriodId: period.id,
        entryDate: ft.transactionDate,
        description:
          ft.description ?? `FinancialTransaction ${ft.type} ${ft.id}`,
        referenceType: FT_POSTING_REFERENCE_TYPE,
        referenceId: ft.id,
        createdBy: currentUser.userId,
        lines: [
          {
            accountId: debitAccountId,
            debit: amount.toFixed(4),
            credit: '0.0000',
            description: `${ft.type} ${ft.direction}`,
          },
          {
            accountId: creditAccountId,
            debit: '0.0000',
            credit: amount.toFixed(4),
            description: `${ft.type} ${ft.direction}`,
          },
        ],
      },
      tx,
    );

    await this.repository.linkJournalEntry(id, companyId, posted.id, tx);
    await this.auditLog.log(
      {
        companyId,
        userId: currentUser.userId,
        entityType: 'FinancialTransaction',
        entityId: id,
        action: 'POST',
        before: { postingStatus: 'DRAFT' },
        after: { postingStatus: 'POSTED', journalEntryId: posted.id },
      },
      tx,
    );

    const updated = await this.repository.findById(id, companyId, tx);
    return FinancialTransactionMapper.toEntity(updated!);
  }

  /**
   * G15-07-C3-A — reversal of a POSTED FinancialTransaction.
   *
   * CAS-claim POSTED → REVERSED, then create a compensating FT row plus a
   * negated JE in the SAME transaction (GlEngine.reverse() owns its own
   * transaction and therefore cannot be nested here — its compensating-entry
   * semantics are reproduced through GlEngine.post()).
   */
  async reverse(
    id: string,
    currentUser: JwtPayload,
    reason?: string,
    idempotencyKey?: string,
  ): Promise<FinancialTransactionEntity> {
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId: currentUser.companyId,
      idempotencyKey,
      endpoint: 'financial-transactions.reverse',
      requestHashPayload: { id, userId: currentUser.userId, reason },
      status: HttpStatus.OK,
      work: (tx) => this.applyReverse(id, currentUser, reason, tx),
    });
    return result.body as FinancialTransactionEntity;
  }

  private async applyReverse(
    id: string,
    currentUser: JwtPayload,
    reason: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<FinancialTransactionEntity> {
    const companyId = currentUser.companyId;
    const ft = await this.repository.findById(id, companyId, tx);
    if (!ft) throw new NotFoundException('Financial transaction not found');
    if (ft.postingStatus !== 'POSTED' || !ft.journalEntryId) {
      throw new ConflictException(
        'Only a POSTED FinancialTransaction with a journal entry can be reversed',
      );
    }

    const claimed = await this.repository.claimPostingStatus(
      id,
      companyId,
      'POSTED',
      'REVERSED',
      ft.rowVersion,
      tx,
    );
    if (claimed === 0) {
      throw new ConflictException(
        'Financial transaction was reversed or modified concurrently',
      );
    }

    const originalEntry = await tx.journalEntry.findFirst({
      where: { id: ft.journalEntryId, companyId },
      include: { lines: true },
    });
    if (!originalEntry || originalEntry.status !== 'POSTED') {
      throw new BadRequestException(
        'Original journal entry is not available for reversal',
      );
    }

    await this.calendarService.ensureCurrentCalendar(companyId, tx);
    const now = new Date();
    const period = await this.resolveOpenPeriod(companyId, now, tx);

    const reversal = await this.glEngine.post(
      {
        companyId,
        financialPeriodId: period.id,
        entryDate: now,
        description: `Reversal of FinancialTransaction ${ft.id}: ${reason ?? 'manual reversal'}`,
        referenceType: FT_REVERSAL_REFERENCE_TYPE,
        referenceId: ft.journalEntryId,
        createdBy: currentUser.userId,
        lines: (originalEntry.lines ?? []).map((line) => ({
          accountId: line.accountId,
          debit: line.credit.toString(),
          credit: line.debit.toString(),
          description: `REVERSAL: ${reason ?? `FinancialTransaction ${ft.id}`}`,
        })),
      },
      tx,
    );

    const compensating = await this.repository.create(
      {
        type: ft.type,
        direction:
          ft.direction === 'INFLOW'
            ? TransactionDirection.OUTFLOW
            : TransactionDirection.INFLOW,
        amount: ft.amount.toString(),
        fee: '0',
        netAmount: ft.amount.toString(),
        currency: ft.currency,
        transactionDate: now,
        description: `Reversal of ${ft.id}: ${reason ?? 'manual reversal'}`,
        cashAccount:
          ft.cashAccountId !== null && ft.cashAccountId !== undefined
            ? { connect: { id: ft.cashAccountId } }
            : undefined,
        bankAccount:
          ft.bankAccountId !== null && ft.bankAccountId !== undefined
            ? { connect: { id: ft.bankAccountId } }
            : undefined,
        destinationBankAccount:
          ft.destinationBankAccountId !== null &&
          ft.destinationBankAccountId !== undefined
            ? { connect: { id: ft.destinationBankAccountId } }
            : undefined,
        referenceType: FT_REVERSAL_REFERENCE_TYPE,
        referenceId: ft.id,
        postingStatus: 'POSTED',
        journalEntry: { connect: { id: reversal.id } },
        company: { connect: { id: companyId } },
        createdByUser: { connect: { id: currentUser.userId } },
      },
      tx,
    );

    await this.auditLog.log(
      {
        companyId,
        userId: currentUser.userId,
        entityType: 'FinancialTransaction',
        entityId: id,
        action: 'REVERSE',
        before: { postingStatus: 'POSTED' },
        after: {
          postingStatus: 'REVERSED',
          compensatingId: compensating.id,
          reversalEntryId: reversal.id,
        },
      },
      tx,
    );

    return FinancialTransactionMapper.toEntity(compensating);
  }

  async findAll(
    query: FinancialTransactionQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: FinancialTransactionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

    const result = await this.repository.findAll({
      companyId: currentUser.companyId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      type: query.type,
      direction: query.direction,
      cashAccountId: query.cashAccountId,
      bankAccountId: query.bankAccountId,
      isReconciled: query.isReconciled,
      postingStatus: query.postingStatus,
      search: query.search,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: FinancialTransactionMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    currentUser: JwtPayload,
  ): Promise<FinancialTransactionEntity> {
    const tx = await this.repository.findById(id, currentUser.companyId);
    if (!tx) throw new NotFoundException('Financial transaction not found');
    return FinancialTransactionMapper.toEntity(tx);
  }

  async update(
    id: string,
    dto: UpdateFinancialTransactionDto,
    currentUser: JwtPayload,
  ): Promise<FinancialTransactionEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Financial transaction not found');

    // C3-A freeze: financial fields are immutable once the row leaves DRAFT.
    // Legacy rows predate the lifecycle (schema default covers new writes);
    // a NULL status is treated as DRAFT for backward compatibility.
    const frozen =
      before.postingStatus !== null &&
      before.postingStatus !== undefined &&
      before.postingStatus !== 'DRAFT';
    if (frozen) {
      const attempted = (FROZEN_FIELDS as readonly string[]).filter(
        (field) => (dto as Record<string, unknown>)[field] !== undefined,
      );
      if (attempted.length > 0) {
        throw new ConflictException(
          `Financial transaction is ${before.postingStatus}: financial ` +
            `fields (${attempted.join(', ')}) are immutable. Reverse the ` +
            `transaction to correct it.`,
        );
      }
    }

    const data: Prisma.FinancialTransactionUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.referenceNumber !== undefined)
      data.referenceNumber = dto.referenceNumber;
    if (dto.referenceType !== undefined)
      data.referenceType = dto.referenceType;
    if (dto.referenceId !== undefined) data.referenceId = dto.referenceId;
    if (dto.isReconciled !== undefined) data.isReconciled = dto.isReconciled;
    if (dto.type !== undefined)
      data.type = dto.type as FinancialTransactionType;
    if (dto.direction !== undefined)
      data.direction = dto.direction as TransactionDirection;
    if (dto.currency !== undefined) data.currency = dto.currency as Currency;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.transactionDate !== undefined)
      data.transactionDate = dto.transactionDate;
    if (dto.fee !== undefined) {
      data.fee = dto.fee;
      const fee = dto.fee || '0';
      data.netAmount = new Decimal(before.amount.toString())
        .minus(new Decimal(fee))
        .toString();
    }
    if (dto.cashAccountId !== undefined) {
      data.cashAccount = dto.cashAccountId
        ? { connect: { id: dto.cashAccountId } }
        : { disconnect: true };
    }
    if (dto.bankAccountId !== undefined) {
      data.bankAccount = dto.bankAccountId
        ? { connect: { id: dto.bankAccountId } }
        : { disconnect: true };
    }
    if (dto.destinationBankAccountId !== undefined) {
      data.destinationBankAccount = dto.destinationBankAccountId
        ? { connect: { id: dto.destinationBankAccountId } }
        : { disconnect: true };
    }

    const [updated] = await this.prismaService.$transaction(async (txCtx) => {
      const result = await this.repository.update(
        id,
        data,
        currentUser.companyId,
        before.rowVersion,
        txCtx,
      );
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'FinancialTransaction',
          entityId: id,
          action: 'UPDATE',
          before,
          after: result,
        },
        txCtx,
      );
      return [result];
    });
    return FinancialTransactionMapper.toEntity(updated);
  }

  // ── posting internals ────────────────────────────────────────────────

  /**
   * Resolve one plan leg to a ChartOfAccount id. Domain-counterpart legs
   * ('__DOMAIN__') carry the resolver-supplied account id, revalidated here
   * (defense in depth — same transaction, same company scope).
   */
  private async resolvePlanLeg(
    leg: PostingLeg,
    domainAccountId: string | null,
    ft: {
      cashAccountId: string | null;
      bankAccountId: string | null;
      destinationBankAccountId: string | null;
    },
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    if (leg.kind === 'CHART' && leg.code === '__DOMAIN__') {
      if (!domainAccountId) {
        // Unreachable: planPosting only emits domain legs when a counterpart
        // was resolved. Fail closed rather than post to a wrong account.
        throw new BadRequestException(
          'FinancialTransaction has no resolvable economic counterpart.',
        );
      }
      const account = await tx.chartOfAccount.findFirst({
        where: {
          id: domainAccountId,
          companyId,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!account) {
        throw new BadRequestException(
          'Resolved counterpart account is not available for this company.',
        );
      }
      return account.id;
    }
    return this.resolveLegAccount(leg, ft, companyId, tx);
  }

  private assertNotSaleLinked(
    ft: { referenceType: string | null; referenceId: string | null },
    companyId: string,
    saleLinkExists: boolean,
  ): void {
    if (claimsSaleRefundOwnership(ft.referenceType)) {
      throw new BadRequestException(
        `FinancialTransaction REFUND claims sale/refund-domain ownership ` +
          `(referenceType "${ft.referenceType}"): sale-linked refunds must ` +
          `flow through the sales refund domain, which already posts the GL ` +
          `reversal. Posting here would double-count.`,
      );
    }
    if (saleLinkExists) {
      throw new BadRequestException(
        'FinancialTransaction REFUND references an existing Sale/SalesRefund: ' +
          'sale-linked refunds must flow through the sales refund domain.',
      );
    }
  }

  private async saleLinkExists(
    ft: { referenceId: string | null },
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    if (!ft.referenceId) return false;
    const [sale, refund] = await Promise.all([
      tx.sale.findFirst({ where: { id: ft.referenceId, companyId } }),
      tx.salesRefund.findFirst({
        where: { id: ft.referenceId, companyId },
      }),
    ]);
    return sale !== null || refund !== null;
  }

  private async resolveDomainCounterpartId(
    ft: {
      referenceType: string | null;
      referenceId: string | null;
    },
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string | null> {
    if (!ft.referenceType || !ft.referenceId) return null;
    const resolver = this.counterpartResolvers.get(
      ft.referenceType.toUpperCase(),
    );
    if (!resolver) return null;
    const resolved = await resolver(
      { referenceType: ft.referenceType, referenceId: ft.referenceId },
      { companyId, tx },
    );
    if (!resolved) return null;
    // Same-company, active, non-deleted — never trust a resolver blindly.
    const account = await tx.chartOfAccount.findFirst({
      where: {
        id: resolved.accountId,
        companyId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    return account?.id ?? null;
  }

  private async resolveLegAccount(
    leg: PostingLeg,
    ft: {
      cashAccountId: string | null;
      bankAccountId: string | null;
      destinationBankAccountId: string | null;
    },
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    if (leg.kind === 'CHART') {
      // '__DOMAIN__' legs are substituted by the caller before this runs;
      // reaching here with one is a programming error, never user input.
      if (!leg.code || leg.code === '__DOMAIN__') {
        throw new BadRequestException(
          'FinancialTransaction has no resolvable economic counterpart.',
        );
      }
      const account = await tx.chartOfAccount.findFirst({
        where: {
          companyId,
          code: leg.code,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!account) {
        throw new BadRequestException(
          `Chart of Accounts not configured — account ${leg.code} not found ` +
            `for this company. Run the chart backfill, then retry.`,
        );
      }
      return account.id;
    }

    const registerId =
      leg.kind === 'CASH'
        ? ft.cashAccountId
        : leg.kind === 'BANK'
          ? ft.bankAccountId
          : ft.destinationBankAccountId;
    if (!registerId) {
      throw new BadRequestException(
        'FinancialTransaction is missing the cash/bank register for posting.',
      );
    }
    // Prefer the register's linked GL account (custom CoA compatible);
    // otherwise fall back to the family default (1010 cash / 1020 bank).
    const linked = await this.findLinkedChartAccount(
      leg.kind,
      registerId,
      companyId,
      tx,
    );
    if (linked) return linked;
    const fallback = await tx.chartOfAccount.findFirst({
      where: {
        companyId,
        code:
          leg.kind === 'CASH'
            ? FAMILY_FALLBACK_CODE.CASH
            : FAMILY_FALLBACK_CODE.BANK,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!fallback) {
      throw new BadRequestException(
        'Chart of Accounts not configured — cash/bank accounts (1010/1020) ' +
          'not found for this company.',
      );
    }
    return fallback.id;
  }

  private async findLinkedChartAccount(
    legKind: 'CASH' | 'BANK' | 'DEST_BANK',
    registerId: string,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string | null> {
    // F-AUD-02: the register itself must be a live row. A soft-deleted,
    // deactivated, or foreign-company register fails closed here instead of
    // silently falling back to the family account.
    const liveRegister =
      legKind === 'CASH'
        ? await tx.cashAccount.findFirst({
            where: {
              id: registerId,
              companyId,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true, chartOfAccountId: true },
          })
        : await tx.bankAccount.findFirst({
            where: {
              id: registerId,
              companyId,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true, chartOfAccountId: true },
          });
    if (!liveRegister) {
      throw new BadRequestException(
        'Cash/bank register is not available for posting: it is missing, ' +
          'deactivated, deleted, or belongs to another company.',
      );
    }
    const register = liveRegister;
    if (!register?.chartOfAccountId) return null;
    const chart = await tx.chartOfAccount.findFirst({
      where: {
        id: register.chartOfAccountId,
        companyId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    return chart?.id ?? null;
  }

  private async resolveOpenPeriod(
    companyId: string,
    entryDate: Date,
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    const period = await tx.financialPeriod.findFirst({
      where: {
        companyId,
        status: 'OPEN',
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (!period) {
      throw new BadRequestException(
        `No OPEN financial period covers ${entryDate.toISOString()} for this company`,
      );
    }
    return period;
  }
}
