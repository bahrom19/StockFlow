/**
 * G15-07-C3-A — server-side posting policy for FinancialTransaction → GL.
 *
 * Pure mapping module (no database, no Nest dependencies) so the matrix is
 * unit-testable in isolation. The service layer resolves leg descriptors to
 * company-scoped ChartOfAccount ids and performs the sale-ownership checks.
 *
 * Core invariant (D1 hybrid, default-deny):
 *  - self-contained kinds (pure transfers, FEE, INTEREST) post from this map;
 *  - kinds requiring an economic counterpart (CASH_IN, CASH_OUT,
 *    CARD_DEPOSIT, CARD_WITHDRAWAL, REFUND) post ONLY when a domain resolver
 *    supplies the counterpart — C3-A registers none, so they fail closed;
 *  - deferred domain kinds (loans, dividend, tax) are rejected deterministically.
 */

export type PostingLegKind = 'CASH' | 'BANK' | 'DEST_BANK' | 'CHART';

export interface PostingLeg {
  kind: PostingLegKind;
  /** Required when kind === 'CHART': the system account code (e.g. '6100'). */
  code?: string;
}

export type PostingDenyCode =
  | 'DEFERRED_TYPE'
  | 'UNRESOLVABLE_COUNTERPART'
  | 'SALE_LINKED_REFUND'
  | 'DIRECTION_MISMATCH'
  | 'MISSING_LEG';

export type PostingPlan =
  | {
      postable: true;
      debit: PostingLeg;
      credit: PostingLeg;
      activity: 'OPERATING' | 'TRANSFER';
    }
  | { postable: false; code: PostingDenyCode; message: string };

/** Types whose economics belong to future domains — never post in C3-A. */
export const DEFERRED_POSTING_TYPES: ReadonlySet<string> = new Set([
  'LOAN_DISBURSEMENT',
  'LOAN_REPAYMENT',
  'DIVIDEND',
  'TAX_PAYMENT',
]);

/**
 * Reference types that claim sale/refund-domain ownership. A
 * FinancialTransaction carrying one of these MUST NOT create its own GL
 * posting for the same economics (D6 double-post guard). Compared after
 * upper-casing and stripping non-alphanumeric characters.
 */
const SALE_REFUND_OWNERSHIP = new Set(['SALE', 'REFUND', 'SALESREFUND']);

export function claimsSaleRefundOwnership(
  referenceType: string | null | undefined,
): boolean {
  if (!referenceType) return false;
  const normalized = referenceType.toUpperCase().replace(/[^A-Z]/g, '');
  return SALE_REFUND_OWNERSHIP.has(normalized);
}

/** Strict direction requirements. Transfers treat direction as informational. */
const REQUIRED_DIRECTION: Record<string, 'INFLOW' | 'OUTFLOW'> = {
  CASH_IN: 'INFLOW',
  CASH_OUT: 'OUTFLOW',
  CARD_DEPOSIT: 'INFLOW',
  CARD_WITHDRAWAL: 'OUTFLOW',
  FEE: 'OUTFLOW',
  INTEREST: 'INFLOW',
};

export interface PostingPlanInput {
  type: string;
  direction: string;
  cashAccountId: string | null | undefined;
  bankAccountId: string | null | undefined;
  destinationBankAccountId: string | null | undefined;
  /** True when a registered domain resolver supplied the counterpart. */
  hasDomainCounterpart: boolean;
}

/**
 * Resolve the debit/credit leg descriptors for a FinancialTransaction.
 * Never touches the database; leg descriptors are resolved to ChartOfAccount
 * ids by the service layer (linked register account or family fallback).
 */
export function planPosting(input: PostingPlanInput): PostingPlan {
  const { type, direction } = input;

  if (DEFERRED_POSTING_TYPES.has(type)) {
    return {
      postable: false,
      code: 'DEFERRED_TYPE',
      message:
        `FinancialTransaction type "${type}" belongs to a deferred domain ` +
        `(loans, dividends and taxes have no canonical GL mapping in C3-A). ` +
        `Posting is rejected deterministically — the row remains operational-only.`,
    };
  }

  const requiredDirection = REQUIRED_DIRECTION[type];
  if (requiredDirection && direction !== requiredDirection) {
    return {
      postable: false,
      code: 'DIRECTION_MISMATCH',
      message:
        `FinancialTransaction type "${type}" requires direction ` +
        `"${requiredDirection}" (received "${direction}").`,
    };
  }

  const hasCash = !!input.cashAccountId;
  const hasBank = !!input.bankAccountId;
  const hasDestBank = !!input.destinationBankAccountId;
  const missingLeg = (which: string): PostingPlan => ({
    postable: false,
    code: 'MISSING_LEG',
    message: `FinancialTransaction type "${type}" requires ${which} to post.`,
  });
  const needsCounterpart = (): PostingPlan => ({
    postable: false,
    code: 'UNRESOLVABLE_COUNTERPART',
    message:
      `FinancialTransaction type "${type}" has no resolvable economic ` +
      `counterpart: C3-A never guesses a GL account for ambiguous ` +
      `transactions. Attach a supported domain reference or leave the row ` +
      `operational-only.`,
  });

  switch (type) {
    case 'BANK_DEPOSIT': {
      if (!hasCash) return missingLeg('cashAccountId (source drawer)');
      if (!hasBank) return missingLeg('bankAccountId (destination bank)');
      return {
        postable: true,
        debit: { kind: 'BANK' },
        credit: { kind: 'CASH' },
        activity: 'TRANSFER',
      };
    }
    case 'BANK_WITHDRAWAL': {
      if (!hasBank) return missingLeg('bankAccountId (source bank)');
      if (!hasCash) return missingLeg('cashAccountId (destination drawer)');
      return {
        postable: true,
        debit: { kind: 'CASH' },
        credit: { kind: 'BANK' },
        activity: 'TRANSFER',
      };
    }
    case 'BANK_TRANSFER': {
      if (!hasBank) return missingLeg('bankAccountId (source bank)');
      if (!hasDestBank)
        return missingLeg('destinationBankAccountId (destination bank)');
      if (input.bankAccountId === input.destinationBankAccountId) {
        return {
          postable: false,
          code: 'MISSING_LEG',
          message:
            'BANK_TRANSFER source and destination bank accounts must differ.',
        };
      }
      return {
        postable: true,
        debit: { kind: 'DEST_BANK' },
        credit: { kind: 'BANK' },
        activity: 'TRANSFER',
      };
    }
    case 'INTERNAL_TRANSFER': {
      if (!hasCash) return missingLeg('cashAccountId (one transfer leg)');
      if (!hasBank) return missingLeg('bankAccountId (one transfer leg)');
      // Direction is informational: INFLOW moves bank → drawer, OUTFLOW
      // moves drawer → bank. Legs are type-determined either way.
      return direction === 'INFLOW'
        ? {
            postable: true,
            debit: { kind: 'CASH' },
            credit: { kind: 'BANK' },
            activity: 'TRANSFER',
          }
        : {
            postable: true,
            debit: { kind: 'BANK' },
            credit: { kind: 'CASH' },
            activity: 'TRANSFER',
          };
    }
    case 'FEE': {
      if (hasCash === hasBank)
        return missingLeg('exactly one of cashAccountId / bankAccountId');
      return {
        postable: true,
        debit: { kind: 'CHART', code: '6100' },
        credit: hasCash ? { kind: 'CASH' } : { kind: 'BANK' },
        activity: 'OPERATING',
      };
    }
    case 'INTEREST': {
      if (hasCash === hasBank)
        return missingLeg('exactly one of cashAccountId / bankAccountId');
      return {
        postable: true,
        debit: hasCash ? { kind: 'CASH' } : { kind: 'BANK' },
        credit: { kind: 'CHART', code: '4200' },
        activity: 'OPERATING',
      };
    }
    case 'CASH_IN':
    case 'CARD_DEPOSIT': {
      if (!input.hasDomainCounterpart) return needsCounterpart();
      const legKind = type === 'CASH_IN' ? 'CASH' : 'BANK';
      if (legKind === 'CASH' && !hasCash) return missingLeg('cashAccountId');
      if (legKind === 'BANK' && !hasBank) return missingLeg('bankAccountId');
      // The domain counterpart leg is supplied by the registered resolver;
      // the policy records only the cash/bank side here.
      return {
        postable: true,
        debit: { kind: legKind },
        credit: { kind: 'CHART', code: '__DOMAIN__' },
        activity: 'OPERATING',
      };
    }
    case 'CASH_OUT':
    case 'CARD_WITHDRAWAL': {
      if (!input.hasDomainCounterpart) return needsCounterpart();
      const legKind = type === 'CASH_OUT' ? 'CASH' : 'BANK';
      if (legKind === 'CASH' && !hasCash) return missingLeg('cashAccountId');
      if (legKind === 'BANK' && !hasBank) return missingLeg('bankAccountId');
      return {
        postable: true,
        debit: { kind: 'CHART', code: '__DOMAIN__' },
        credit: { kind: legKind },
        activity: 'OPERATING',
      };
    }
    case 'REFUND': {
      // The sale-ownership check itself lives in the service layer (it needs
      // the database); the policy enforces the counterpart requirement.
      if (!input.hasDomainCounterpart) return needsCounterpart();
      if (hasCash === hasBank)
        return missingLeg('exactly one of cashAccountId / bankAccountId');
      // Direction decides the economic side: OUTFLOW returns money
      // (Dr domain / Cr cash), INFLOW receives a return (Dr cash / Cr domain).
      return direction === 'INFLOW'
        ? {
            postable: true,
            debit: hasCash ? { kind: 'CASH' } : { kind: 'BANK' },
            credit: { kind: 'CHART', code: '__DOMAIN__' },
            activity: 'OPERATING',
          }
        : {
            postable: true,
            debit: { kind: 'CHART', code: '__DOMAIN__' },
            credit: hasCash ? { kind: 'CASH' } : { kind: 'BANK' },
            activity: 'OPERATING',
          };
    }
    default:
      return {
        postable: false,
        code: 'UNRESOLVABLE_COUNTERPART',
        message:
          `FinancialTransaction type "${type}" has no posting rule in C3-A. ` +
          `The row remains operational-only.`,
      };
  }
}

/** JournalEntry reference markers for FT postings and their reversals. */
export const FT_POSTING_REFERENCE_TYPE = 'FINANCIAL_TRANSACTION';
export const FT_REVERSAL_REFERENCE_TYPE = 'FINANCIAL_TRANSACTION_REVERSAL';
