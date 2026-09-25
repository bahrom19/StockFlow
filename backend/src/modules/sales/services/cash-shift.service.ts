import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, Currency } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { runWithIdempotency } from '../../../infrastructure/idempotency/idempotency.helper';
import { CashShiftEntity } from '../entities/cash-shift.entity';
import { CashShiftMapper } from '../mappers/cash-shift.mapper';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import {
  OpenShiftDto,
  CloseShiftDto,
  CashInOutDto,
} from '../dto/cash-shift.dto';
import { CompaniesService } from '../../companies/services/companies.service';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { FiscalCalendarService } from '../../finance/services/fiscal-calendar.service';
import { AuditLogService } from '../../shared/services/audit-log.service';

/**
 * G15-07-C3-B — canonical GL linkage for cash-drawer movements.
 *
 * Every economic movement posts exactly one balanced JournalEntry inside the
 * same transaction as the CashShift mutation:
 *  - CASH_IN:  Dr drawer / Cr fenced counterpart
 *  - CASH_OUT: Dr fenced counterpart / Cr drawer
 *  - SHORTAGE (close): Dr 6200 / Cr drawer
 *  - OVERAGE  (close): Dr drawer / Cr 4210
 *
 * Linkage: JournalEntry { referenceType: 'CASH_SHIFT', referenceId: shift.id }
 * (one shift → many JEs, so no journalEntryId column on CashShift).
 * Sale buckets and refund netting NEVER post here — E4/E5 own that GL.
 */
export const CASH_SHIFT_POSTING_REFERENCE_TYPE = 'CASH_SHIFT';

/** Family fallback drawer GL code when no warehouse register exists. */
const DRAWER_FALLBACK_CODE = '1010';
const SHORTAGE_CODE = '6200';
const OVERAGE_CODE = '4210';

/** System equity accounts that can never serve as movement counterparts. */
const FORBIDDEN_COUNTERPART_CODES = new Set(['3200', '3000']);

@Injectable()
export class CashShiftService {
  constructor(
    private readonly cashShiftRepository: CashShiftRepository,
    private readonly prismaService: PrismaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly companiesService: CompaniesService,
    private readonly glEngine: GlEngineService,
    private readonly calendarService: FiscalCalendarService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Open a cash shift atomically.
   *
   * Race protection (H1): the duplicate-OPEN check AND the insert run inside a
   * single DB transaction, and a partial unique index
   * `CashShift_open_shift_unique` on (warehouseId, cashierId, companyId) WHERE
   * status='OPEN' rejects a second concurrent OPEN shift at the DB level
   * (P2002). Both the pre-check and the P2002 path map to HTTP 409 Conflict.
   */
  async openShift(
    dto: OpenShiftDto,
    userId: string,
    companyId: string,
  ): Promise<CashShiftEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.cashShiftRepository.findOpenShift(
        dto.warehouseId,
        userId,
        companyId,
        tx,
      );
      if (existing) {
        throw new ConflictException(
          'An open shift already exists for this warehouse and cashier',
        );
      }

      // Enforce document currency == Company.currency
      const companyCurrency = await this.companiesService.getBaseCurrency(companyId);
      if (dto.currency && dto.currency !== companyCurrency) {
        throw new BadRequestException(
          `Currency ${dto.currency} does not match company currency ${companyCurrency}`,
        );
      }

      try {
        const shift = await this.cashShiftRepository.create(
          {
            openingBalance: new Decimal(dto.openingBalance),
            closingBalance: new Decimal(dto.openingBalance),
            expectedClosing: new Decimal(dto.openingBalance),
            currency: companyCurrency as Currency,
            notes: dto.notes,
            company: { connect: { id: companyId } },
            warehouse: { connect: { id: dto.warehouseId } },
            cashier: { connect: { id: userId } },
          },
          tx,
        );
        return CashShiftMapper.toEntity(shift);
      } catch (err) {
        // DB-level protection: a concurrent request already opened a shift
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException(
            'An open shift already exists for this warehouse and cashier',
          );
        }
        throw err;
      }
    });
  }

  async closeShift(
    dto: CloseShiftDto,
    userId: string,
    companyId: string,
    warehouseId: string,
  ): Promise<CashShiftEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const shift = await this.cashShiftRepository.findOpenShift(
        warehouseId,
        userId,
        companyId,
        tx,
      );
      if (!shift) throw new NotFoundException('No open shift found');

      const openingBalance = new Decimal(shift.openingBalance.toString());
      const cashSales = new Decimal(shift.cashSales.toString());
      const cardSales = new Decimal(shift.cardSales.toString());
      const cashIn = new Decimal(shift.cashIn.toString());
      const cashOut = new Decimal(shift.cashOut.toString());
      // G11-F1 (GAP-B): partial refunds pay the cash part back out of the
      // drawer, but only the legacy FULL refund netts cashSales at refund
      // time (G11-D). Partial refunds carry E5 allocation facts instead, so
      // closeShift nets their COMPLETED CASH allocations here — exactly once,
      // tenant-scoped, bound to THIS shift through Sale.cashShiftId.
      // CARD/QR/BANK/MOBILE/STORE_CREDIT/GIFT_CARD allocations never affect
      // the drawer. Full legacy refunds have no allocation rows, so this
      // member is structurally zero for them (no double netting).
      const partialCashRefunds = new Decimal(
        (
          await tx.refundPaymentAllocation.aggregate({
            where: {
              companyId,
              method: 'CASH',
              deletedAt: null,
              salesRefund: {
                status: 'COMPLETED',
                deletedAt: null,
                sale: { cashShiftId: shift.id },
              },
            },
            _sum: { amount: true },
          })
        )._sum.amount?.toString() ?? '0',
      );
      const expectedClosing = openingBalance
        .add(cashSales)
        .add(cashIn)
        .sub(cashOut)
        .sub(partialCashRefunds);
      const actualClosing =
        dto.actualClosingBalance != null
          ? new Decimal(dto.actualClosingBalance)
          : expectedClosing;
      const difference = actualClosing.sub(expectedClosing);

      // G15-07-C3-B: resolve the drawer GL account and the posting period
      // BEFORE the terminal CAS close. A non-zero difference posts exactly
      // one JE afterwards; validation failures here leave the shift OPEN.
      const drawerAccountId = await this.resolveDrawerAccount(
        tx,
        companyId,
        warehouseId,
        shift.currency,
      );
      await this.calendarService.ensureCurrentCalendar(companyId, tx);
      const now = new Date();
      const period = await this.resolveOpenPeriod(companyId, now, tx);

      const updated = await this.cashShiftRepository.update(
        shift.id,
        {
          status: 'CLOSED',
          closedAt: new Date(),
          closingBalance: actualClosing,
          expectedClosing,
          difference,
          notes: dto.notes ?? shift.notes,
        },
        companyId,
        shift.rowVersion ?? 0,
        tx,
      );

      // G15-07-C3-B: the difference is the only close-time economic event.
      // Shortage: Dr 6200 / Cr drawer. Overage: Dr drawer / Cr 4210.
      // Zero difference, the CLOSE transition itself, sale buckets and refund
      // netting never post — E4/E5 own that GL.
      if (!difference.isZero()) {
        const isShortage = difference.isNegative();
        const gapAccountId = await this.resolveSystemAccount(
          tx,
          companyId,
          isShortage ? SHORTAGE_CODE : OVERAGE_CODE,
        );
        const gapAmount = difference.abs().toFixed(4);
        const posted = await this.glEngine.post(
          {
            companyId,
            financialPeriodId: period.id,
            entryDate: now,
            description:
              `Cash shift ${isShortage ? 'shortage' : 'overage'} ` +
              `${gapAmount} on close of shift ${shift.id}` +
              (dto.notes ? `: ${dto.notes}` : ''),
            referenceType: CASH_SHIFT_POSTING_REFERENCE_TYPE,
            referenceId: shift.id,
            createdBy: userId,
            lines: isShortage
              ? [
                  {
                    accountId: gapAccountId,
                    debit: gapAmount,
                    credit: '0.0000',
                    description: 'Cash shortage on shift close',
                  },
                  {
                    accountId: drawerAccountId,
                    debit: '0.0000',
                    credit: gapAmount,
                    description: 'Cash shortage on shift close',
                  },
                ]
              : [
                  {
                    accountId: drawerAccountId,
                    debit: gapAmount,
                    credit: '0.0000',
                    description: 'Cash overage on shift close',
                  },
                  {
                    accountId: gapAccountId,
                    debit: '0.0000',
                    credit: gapAmount,
                    description: 'Cash overage on shift close',
                  },
                ],
          },
          tx,
        );
        await this.auditLog.log(
          {
            companyId,
            userId,
            entityType: 'CashShift',
            entityId: shift.id,
            action: isShortage ? 'SHORTAGE' : 'OVERAGE',
            before: {
              status: 'OPEN',
              expectedClosing: expectedClosing.toString(),
            },
            after: {
              status: 'CLOSED',
              actualClosing: actualClosing.toString(),
              difference: difference.toString(),
              journalEntryId: posted.id,
            },
          },
          tx,
        );
      }

      return CashShiftMapper.toEntity(updated);
    });
  }

  async cashIn(
    dto: CashInOutDto,
    userId: string,
    companyId: string,
    warehouseId: string,
    idempotencyKey?: string,
  ): Promise<CashShiftEntity> {
    return this.cashMutation(
      dto,
      userId,
      companyId,
      warehouseId,
      'cashIn',
      idempotencyKey,
    );
  }

  async cashOut(
    dto: CashInOutDto,
    userId: string,
    companyId: string,
    warehouseId: string,
    idempotencyKey?: string,
  ): Promise<CashShiftEntity> {
    return this.cashMutation(
      dto,
      userId,
      companyId,
      warehouseId,
      'cashOut',
      idempotencyKey,
    );
  }

  /**
   * F2 — idempotency-aware entry point for cashIn/cashOut.
   *
   * The reservation, the read-modify-write mutation and the saved response
   * run inside ONE Prisma transaction (via `runWithIdempotency`), so the same
   * Idempotency-Key can never increment `CashShift.cashIn`/`cashOut` twice.
   * Because the shift lookup and amount arithmetic are part of the same
   * transaction, the atomicity and optimistic-locking (rowVersion) guarantees
   * of the underlying mutation are preserved on the keyed path.
   *
   * G15-07-C3-B: the GL posting for the movement executes inside the SAME
   * transaction (and therefore under the same idempotency identity), so an
   * offline-outbox replay can never create a second JournalEntry.
   */
  private async cashMutation(
    dto: CashInOutDto,
    userId: string,
    companyId: string,
    warehouseId: string,
    kind: 'cashIn' | 'cashOut',
    idempotencyKey?: string,
  ): Promise<CashShiftEntity> {
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId,
      idempotencyKey,
      endpoint: kind === 'cashIn' ? 'cash-in' : 'cash-out',
      // The warehouse, acting user, amount, reason AND counterpart all change
      // the economic effect, so they are part of the request hash: same key +
      // different payload deterministically conflicts (422).
      requestHashPayload: { ...dto, warehouseId, userId },
      status: HttpStatus.OK,
      work: (tx) =>
        this.applyCashMutation(
          dto,
          userId,
          companyId,
          warehouseId,
          kind,
          idempotencyKey,
          tx,
        ),
    });
    return result.body as CashShiftEntity;
  }

  /**
   * Shared atomic read-modify-write for cashIn/cashOut (H2). The read, the
   * Decimal arithmetic and the rowVersion-guarded write all happen inside one
   * transaction, so a concurrent mutation cannot be silently lost.
   *
   * G15-07-C3-B: the movement's JournalEntry posts in the same transaction
   * AFTER the guarded shift update — cash mutation and GL are all-or-nothing.
   */
  private async applyCashMutation(
    dto: CashInOutDto,
    userId: string,
    companyId: string,
    warehouseId: string,
    kind: 'cashIn' | 'cashOut',
    idempotencyKey: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<CashShiftEntity> {
    const shift = await this.cashShiftRepository.findOpenShift(
      warehouseId,
      userId,
      companyId,
      tx,
    );
    if (!shift) throw new NotFoundException('No open shift found');

    const amount = new Decimal(dto.amount);
    if (amount.isNegative() || amount.isZero()) {
      throw new BadRequestException('Amount must be positive');
    }

    // G15-07-C3-B: resolve drawer + fenced counterpart BEFORE mutating.
    // Failures here leave the shift untouched (fail closed, no partial JE).
    const drawerAccountId = await this.resolveDrawerAccount(
      tx,
      companyId,
      warehouseId,
      shift.currency,
    );
    const counterpartAccountId = await this.resolveCounterpartAccount(
      tx,
      companyId,
      dto.counterpartAccountId,
      drawerAccountId,
    );
    await this.calendarService.ensureCurrentCalendar(companyId, tx);
    const now = new Date();
    const period = await this.resolveOpenPeriod(companyId, now, tx);

    const current =
      kind === 'cashIn'
        ? new Decimal(shift.cashIn.toString())
        : new Decimal(shift.cashOut.toString());

    const updated = await this.cashShiftRepository.update(
      shift.id,
      {
        [kind]: current.add(amount),
        notes: dto.reason
          ? `${shift.notes ?? ''} ${kind === 'cashIn' ? 'In' : 'Out'}: ${dto.reason}`.trim()
          : shift.notes,
      },
      companyId,
      shift.rowVersion ?? 0,
      tx,
    );

    const amountStr = amount.toFixed(4);
    const posted = await this.glEngine.post(
      {
        companyId,
        financialPeriodId: period.id,
        entryDate: now,
        description:
          `Cash shift ${kind === 'cashIn' ? 'cash-in' : 'cash-out'} ` +
          `${amountStr} on shift ${shift.id}` +
          (dto.reason ? `: ${dto.reason}` : '') +
          (idempotencyKey ? ` [key ${idempotencyKey}]` : ''),
        referenceType: CASH_SHIFT_POSTING_REFERENCE_TYPE,
        referenceId: shift.id,
        createdBy: userId,
        lines:
          kind === 'cashIn'
            ? [
                {
                  accountId: drawerAccountId,
                  debit: amountStr,
                  credit: '0.0000',
                  description: `Cash ${kind} ${amountStr}`,
                },
                {
                  accountId: counterpartAccountId,
                  debit: '0.0000',
                  credit: amountStr,
                  description: `Cash ${kind} ${amountStr}`,
                },
              ]
            : [
                {
                  accountId: counterpartAccountId,
                  debit: amountStr,
                  credit: '0.0000',
                  description: `Cash ${kind} ${amountStr}`,
                },
                {
                  accountId: drawerAccountId,
                  debit: '0.0000',
                  credit: amountStr,
                  description: `Cash ${kind} ${amountStr}`,
                },
              ],
      },
      tx,
    );

    await this.auditLog.log(
      {
        companyId,
        userId,
        entityType: 'CashShift',
        entityId: shift.id,
        action: kind === 'cashIn' ? 'CASH_IN' : 'CASH_OUT',
        before: {
          [kind]: current.toString(),
          currency: shift.currency,
        },
        after: {
          [kind]: current.add(amount).toString(),
          currency: shift.currency,
          reason: dto.reason ?? null,
          counterpartAccountId,
          drawerAccountId,
          journalEntryId: posted.id,
          idempotencyKey: idempotencyKey ?? null,
        },
      },
      tx,
    );

    return CashShiftMapper.toEntity(updated);
  }

  async getXReport(
    userId: string,
    companyId: string,
    warehouseId: string,
  ): Promise<CashShiftEntity> {
    const shift = await this.cashShiftRepository.findOpenShift(
      warehouseId,
      userId,
      companyId,
    );
    if (!shift) throw new NotFoundException('No open shift found');
    return CashShiftMapper.toEntity(shift);
  }

  async getZReport(
    shiftId: string,
    companyId: string,
  ): Promise<CashShiftEntity> {
    const shift = await this.cashShiftRepository.findById(shiftId, companyId);
    if (!shift) throw new NotFoundException(`Cash shift ${shiftId} not found`);
    return CashShiftMapper.toEntity(shift);
  }

  async listShifts(
    companyId: string,
    params: {
      warehouseId?: string;
      cashierId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    items: CashShiftEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');
    const result = await this.cashShiftRepository.listByCompany(
      companyId,
      params,
    );
    return {
      items: CashShiftMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  // ── G15-07-C3-B posting internals ────────────────────────────────────

  /**
   * Deterministic drawer resolution for a shift:
   *  - 0 live warehouse registers → family fallback 1010 (validated).
   *  - 1 live register → its linked chart (validated) else 1010 fallback.
   *  - N > 1 live registers → fail closed (ambiguous drawer; never
   *    "first row", never DB-order dependent).
   * The final drawer account must be an ASSET in the shift currency scope.
   */
  private async resolveDrawerAccount(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    shiftCurrency: string,
  ): Promise<string> {
    const registers = await tx.cashAccount.findMany({
      where: { companyId, warehouseId, isActive: true, deletedAt: null },
      select: { id: true, currency: true, chartOfAccountId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (registers.length > 1) {
      throw new BadRequestException(
        'Cash drawer is ambiguous: multiple active cash registers exist ' +
          'for this warehouse. Resolve the registers before posting.',
      );
    }
    const register = registers[0];
    if (register) {
      if (register.currency !== shiftCurrency) {
        throw new BadRequestException(
          `Cash register currency ${register.currency} does not match ` +
            `shift currency ${shiftCurrency}.`,
        );
      }
      if (register.chartOfAccountId) {
        const linked = await tx.chartOfAccount.findFirst({
          where: {
            id: register.chartOfAccountId,
            companyId,
            isActive: true,
            deletedAt: null,
          },
        });
        if (linked) {
          this.assertDrawerAccount(linked);
          return linked.id;
        }
        // Linked-but-dead chart: fall through to the family fallback
        // (accepted F-RE-01 follow-up semantics — never fail a live drawer
        // for a stale link; the JE still references a valid cash account).
      }
    }
    const fallback = await tx.chartOfAccount.findFirst({
      where: {
        companyId,
        code: DRAWER_FALLBACK_CODE,
        isActive: true,
        deletedAt: null,
      },
    });
    if (!fallback) {
      throw new BadRequestException(
        'Chart of Accounts not configured — cash account 1010 not found ' +
          'for this company.',
      );
    }
    this.assertDrawerAccount(fallback);
    return fallback.id;
  }

  private assertDrawerAccount(account: { code: string; accountType: string }): void {
    if (account.accountType !== 'ASSET') {
      throw new BadRequestException(
        `Cash drawer account "${account.code}" must be of type ASSET ` +
          `(found ${account.accountType}).`,
      );
    }
  }

  /**
   * Fenced counterpart validation for CASH_IN/CASH_OUT (D1 analogue).
   * The counterpart is explicit but never arbitrary: same company, active,
   * non-deleted, P&L type only, never a cash/bank-register account, never
   * the drawer itself, never the 3200/3000 system equity accounts.
   */
  private async resolveCounterpartAccount(
    tx: Prisma.TransactionClient,
    companyId: string,
    counterpartAccountId: string | undefined,
    drawerAccountId: string,
  ): Promise<string> {
    if (!counterpartAccountId) {
      throw new BadRequestException(
        'Cash movement requires an explicit counterpart account: the free-text ' +
          'reason is descriptive only and C3-B never guesses a GL account. ' +
          'Posting fails closed without a valid counterpart.',
      );
    }
    const account = await tx.chartOfAccount.findFirst({
      where: { id: counterpartAccountId, companyId },
    });
    if (!account || !account.isActive || account.deletedAt !== null) {
      throw new BadRequestException(
        'Counterpart account is not available: it is missing, deactivated, ' +
          'deleted, or belongs to another company.',
      );
    }
    if (account.accountType !== 'EXPENSE' && account.accountType !== 'REVENUE') {
      throw new BadRequestException(
        `Counterpart account "${account.code}" must be an EXPENSE or REVENUE ` +
          `account (found ${account.accountType}). Balance-sheet, receivable, ` +
          `payable and inventory accounts belong to their own domains.`,
      );
    }
    if (FORBIDDEN_COUNTERPART_CODES.has(account.code)) {
      throw new BadRequestException(
        `Counterpart account "${account.code}" is a system equity account ` +
          `and cannot be used for cash movements.`,
      );
    }
    if (account.isCashOrBank) {
      throw new BadRequestException(
        `Counterpart account "${account.code}" is a cash/bank account. Cash ` +
          `movements cannot use another cash account as counterpart — use a ` +
          `transfer operation instead.`,
      );
    }
    if (account.id === drawerAccountId) {
      throw new BadRequestException(
        'Counterpart account must differ from the cash drawer account.',
      );
    }
    return account.id;
  }

  /** Resolve a provisioned system account (6200/4210) or fail closed. */
  private async resolveSystemAccount(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string,
  ): Promise<string> {
    const account = await tx.chartOfAccount.findFirst({
      where: { companyId, code, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        `Chart of Accounts not configured — account ${code} not found for ` +
          `this company. Run the chart backfill, then retry.`,
      );
    }
    return account.id;
  }

  /** OPEN period covering the posting date; CLOSED/CLOSING fail closed. */
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
