import { BadRequestException, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerRepository } from '../repositories/ledger.repository';
import { FinancialTransactionsRepository } from '../repositories/financial-transactions.repository';

export type CashFlowCategory =
  | 'OPERATING'
  | 'INVESTING'
  | 'FINANCING'
  | 'TRANSFERS'
  | 'UNCLASSIFIED';

export interface CashFlowRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  referenceType: string | null;
  category: CashFlowCategory;
  inflow: string;
  outflow: string;
  amount: string;
}

export interface CashFlowSection {
  rows: CashFlowRow[];
  total: string;
}

export interface CashFlowResult {
  dateFrom: string;
  dateTo: string;
  beginningCash: string;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  transfers: CashFlowSection;
  unclassified: CashFlowSection;
  netOperating: string;
  netInvesting: string;
  netFinancing: string;
  netTransfers: string;
  netUnclassified: string;
  netCashMovement: string;
  endingCash: string;
  reconciled: boolean;
}

/** Reference types whose cash legs are operating by construction. */
const DIRECT_OPERATING_REFS = new Set([
  'SALE',
  'REFUND',
  'SUPPLIER_PAYMENT',
  'SUPPLIER_PAYMENT_REVERSAL',
  'CASH_SHIFT',
]);

/** FT types that move cash between cash/bank accounts (net-zero). */
const FT_TRANSFER_TYPES = new Set([
  'BANK_DEPOSIT',
  'BANK_WITHDRAWAL',
  'BANK_TRANSFER',
  'INTERNAL_TRANSFER',
]);

/** FT types with operating economics. */
const FT_OPERATING_TYPES = new Set(['FEE', 'INTEREST']);

/**
 * G15-07-C3-C — canonical GL-based Cash Flow statement.
 *
 * Sole source: POSTED JournalLines on the company-scoped cash population
 * (active, non-deleted `isCashOrBank` accounts). Direction comes from
 * debit − credit math; classification from referenceType (+ FT-type and
 * original-JE joins where the reference alone is insufficient).
 * Transfers net to zero emergently (both legs selected); unclassified cash
 * movements are surfaced, never forced and never dropped from footing.
 */
@Injectable()
export class CashFlowService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly financialTransactionsRepository: FinancialTransactionsRepository,
  ) {}

  async getCashFlow(params: {
    companyId: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<CashFlowResult> {
    const { companyId, dateFrom, dateTo } = params;

    if (!dateFrom || !dateTo || isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      throw new BadRequestException(
        'Cash Flow requires valid dateFrom and dateTo calendar dates (YYYY-MM-DD)',
      );
    }
    if (dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException('dateFrom must not be after dateTo');
    }

    // UTC day boundaries: the full dateTo calendar day is included, and no
    // client occurrence timestamp ever reaches the GL aggregation.
    const fromStart = new Date(
      Date.UTC(
        dateFrom.getUTCFullYear(),
        dateFrom.getUTCMonth(),
        dateFrom.getUTCDate(),
        0, 0, 0, 0,
      ),
    );
    const toEnd = new Date(
      Date.UTC(
        dateTo.getUTCFullYear(),
        dateTo.getUTCMonth(),
        dateTo.getUTCDate(),
        23, 59, 59, 999,
      ),
    );

    const iso = (d: Date) => d.toISOString();
    const zeroSection = (): CashFlowSection => ({ rows: [], total: '0.0000' });
    const zeroed = (): CashFlowResult => ({
      dateFrom: iso(fromStart),
      dateTo: iso(toEnd),
      beginningCash: '0.0000',
      operating: zeroSection(),
      investing: zeroSection(),
      financing: zeroSection(),
      transfers: zeroSection(),
      unclassified: zeroSection(),
      netOperating: '0.0000',
      netInvesting: '0.0000',
      netFinancing: '0.0000',
      netTransfers: '0.0000',
      netUnclassified: '0.0000',
      netCashMovement: '0.0000',
      endingCash: '0.0000',
      reconciled: true,
    });

    // ── cash population (authoritative, flag-driven, no code list) ──
    const population = await this.ledgerRepository.findChartOfAccounts({
      companyId,
      isCashOrBank: true,
      isActive: true,
      deletedAt: null,
    });
    if (population.length === 0) return zeroed();

    const accountMap = new Map<string, { code: string; name: string }>(
      population.map((a: any) => [a.id, { code: a.code, name: a.name }]),
    );
    const cashIds = [...accountMap.keys()];
    const netOf = (rows: { totalDebit: Decimal; totalCredit: Decimal }[]) =>
      rows.reduce(
        (acc, r) => acc.add(r.totalDebit).sub(r.totalCredit),
        new Decimal(0),
      );

    // ── beginning / ending (cumulative, independent of sections) ──
    const [openingAgg, endingAgg] = await Promise.all([
      this.ledgerRepository.aggregatedCashFlowLines(companyId, {
        asOfDate: new Date(fromStart.getTime() - 1),
        accountIds: cashIds,
      }),
      this.ledgerRepository.aggregatedCashFlowLines(companyId, {
        asOfDate: toEnd,
        accountIds: cashIds,
      }),
    ]);
    const beginningCash = netOf(openingAgg);
    const endingCash = netOf(endingAgg);

    // ── movement: partition cash-touching JEs, aggregate per partition ──
    const entries = await this.ledgerRepository.findCashJournalEntries(
      companyId,
      { accountIds: cashIds, dateFrom: fromStart, dateTo: toEnd },
    );

    // Resolve FT types and reversal originals in two bounded bulk reads.
    const ftRefIds = [
      ...new Set(
        entries
          .filter((e) => e.referenceType === 'FINANCIAL_TRANSACTION' && e.referenceId)
          .map((e) => e.referenceId as string),
      ),
    ];
    const reversalOriginalIds = [
      ...new Set(
        entries
          .filter((e) => e.referenceType === 'REVERSAL' && e.referenceId)
          .map((e) => e.referenceId as string),
      ),
    ];
    const [ftTypes, originals] = await Promise.all([
      this.financialTransactionsRepository.findTypesByIds(companyId, ftRefIds),
      this.ledgerRepository.findJournalEntriesByIds(
        companyId,
        reversalOriginalIds,
      ),
    ]);
    const ftTypeById = new Map(ftTypes.map((f) => [f.id, f.type]));
    // Originals that are themselves FT postings resolve through the FT map;
    // collect their FT ids in the same bulk read batch.
    const originalFtIds = [
      ...new Set(
        originals
          .filter(
            (o) =>
              o.referenceType === 'FINANCIAL_TRANSACTION' && o.referenceId,
          )
          .map((o) => o.referenceId as string)
          .filter((id) => !ftTypeById.has(id)),
      ),
    ];
    const extraFtTypes =
      originalFtIds.length > 0
        ? await this.financialTransactionsRepository.findTypesByIds(
            companyId,
            originalFtIds,
          )
        : [];
    for (const f of extraFtTypes) ftTypeById.set(f.id, f.type);
    const originalById = new Map(originals.map((o) => [o.id, o]));

    const classifyEntry = (
      e: { id: string; referenceType: string | null; referenceId: string | null },
    ): CashFlowCategory => {
      const ref = e.referenceType;
      if (!ref) return 'UNCLASSIFIED';
      if (DIRECT_OPERATING_REFS.has(ref)) return 'OPERATING';
      if (ref === 'FINANCIAL_TRANSACTION') {
        if (!e.referenceId) return 'UNCLASSIFIED';
        const t = ftTypeById.get(e.referenceId);
        if (!t) return 'UNCLASSIFIED';
        if (FT_TRANSFER_TYPES.has(t)) return 'TRANSFERS';
        if (FT_OPERATING_TYPES.has(t)) return 'OPERATING';
        return 'UNCLASSIFIED';
      }
      if (ref === 'REVERSAL') {
        if (!e.referenceId) return 'UNCLASSIFIED';
        const original = originalById.get(e.referenceId);
        if (!original || !original.referenceType) return 'UNCLASSIFIED';
        // Inherit the original's economics: same category, opposite sign
        // emerges from the negated debit/credit math — no special logic.
        return this.classifyReference(
          original.referenceType,
          original.referenceId,
          ftTypeById,
        );
      }
      // Any other reference on a cash line (including future domains and
      // manual postings): surfaced, never forced, never dropped.
      return 'UNCLASSIFIED';
    };

    // Group JE ids by (category, referenceType) for bounded per-partition
    // aggregation. Investing/Financing stay empty: no posting domain exists.
    const partitions = new Map<
      string,
      { category: CashFlowCategory; referenceType: string | null; ids: string[] }
    >();
    for (const e of entries) {
      const category = classifyEntry(e);
      const key = `${category}::${e.referenceType ?? ''}`;
      let part = partitions.get(key);
      if (!part) {
        part = { category, referenceType: e.referenceType, ids: [] };
        partitions.set(key, part);
      }
      part.ids.push(e.id);
    }

    const rowsByCategory = new Map<CashFlowCategory, CashFlowRow[]>();
    const totals = new Map<CashFlowCategory, Decimal>();
    const bump = (category: CashFlowCategory, row: CashFlowRow, net: Decimal) => {
      const list = rowsByCategory.get(category) ?? [];
      list.push(row);
      rowsByCategory.set(category, list);
      totals.set(category, (totals.get(category) ?? new Decimal(0)).add(net));
    };

    await Promise.all(
      [...partitions.values()].map(async (part) => {
        const sums = await this.ledgerRepository.aggregatedCashFlowLines(
          companyId,
          {
            accountIds: cashIds,
            journalEntryIds: part.ids,
            dateFrom: fromStart,
            dateTo: toEnd,
          },
        );
        for (const s of sums) {
          const meta = accountMap.get(s.accountId);
          if (!meta) continue;
          const net = s.totalDebit.sub(s.totalCredit);
          if (net.isZero()) continue;
          bump(
            part.category,
            {
              accountId: s.accountId,
              accountCode: meta.code,
              accountName: meta.name,
              referenceType: part.referenceType,
              category: part.category,
              inflow: s.totalDebit.toFixed(4),
              outflow: s.totalCredit.toFixed(4),
              amount: net.toFixed(4),
            },
            net,
          );
        }
      }),
    );

    const sectionOf = (category: CashFlowCategory): CashFlowSection => {
      const rows = (rowsByCategory.get(category) ?? []).sort((a, b) =>
        a.accountCode < b.accountCode
          ? -1
          : a.accountCode > b.accountCode
            ? 1
            : (a.referenceType ?? '') < (b.referenceType ?? '')
              ? -1
              : 1,
      );
      return {
        rows,
        total: (totals.get(category) ?? new Decimal(0)).toFixed(4),
      };
    };

    const operating = sectionOf('OPERATING');
    const investing = sectionOf('INVESTING');
    const financing = sectionOf('FINANCING');
    const transfers = sectionOf('TRANSFERS');
    const unclassified = sectionOf('UNCLASSIFIED');

    const sumParts = (
      parts: Decimal[],
    ): Decimal => parts.reduce((acc, p) => acc.add(p), new Decimal(0));
    const netCashMovement = sumParts([
      new Decimal(operating.total),
      new Decimal(investing.total),
      new Decimal(financing.total),
      new Decimal(transfers.total),
      new Decimal(unclassified.total),
    ]);
    const footing = beginningCash.add(netCashMovement);

    return {
      dateFrom: iso(fromStart),
      dateTo: iso(toEnd),
      beginningCash: beginningCash.toFixed(4),
      operating,
      investing,
      financing,
      transfers,
      unclassified,
      netOperating: operating.total,
      netInvesting: investing.total,
      netFinancing: financing.total,
      netTransfers: transfers.total,
      netUnclassified: unclassified.total,
      netCashMovement: netCashMovement.toFixed(4),
      endingCash: endingCash.toFixed(4),
      reconciled: endingCash.equals(footing),
    };
  }

  /** Category for a bare (referenceType, referenceId) pair. */
  private classifyReference(
    referenceType: string,
    referenceId: string | null,
    ftTypeById: Map<string, string>,
  ): CashFlowCategory {
    if (DIRECT_OPERATING_REFS.has(referenceType)) return 'OPERATING';
    if (referenceType === 'FINANCIAL_TRANSACTION') {
      const t = referenceId ? ftTypeById.get(referenceId) : undefined;
      if (t && FT_TRANSFER_TYPES.has(t)) return 'TRANSFERS';
      if (t && FT_OPERATING_TYPES.has(t)) return 'OPERATING';
      return 'UNCLASSIFIED';
    }
    if (referenceType === 'CASH_SHIFT') return 'OPERATING';
    return 'UNCLASSIFIED';
  }
}
