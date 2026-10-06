/**
 * G16-N-7 — structural regression guards.
 *
 * These are deliberately FOCUSED source assertions rather than a broad static
 * analyser: each one pins a specific defect class that this workstream closed,
 * so a future edit that reintroduces it fails here with an actionable message.
 *
 * They complement — and never replace — the behavioural unit and real-Postgres
 * integration tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');

const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

const fiscalYearClose = read('services/fiscal-year-close.service.ts');
const journalEntries = read('services/journal-entries.service.ts');

/**
 * Strip block and line comments so a guard can never be satisfied (or
 * defeated) by prose. The G16-N-7 files document the OLD defective code in
 * their comments, so checking the raw source would produce false results.
 */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const fyc = code(fiscalYearClose);
const jes = code(journalEntries);

describe('G16-N-7 structural guards — fiscal-year close', () => {
  it('D1: the AccountBalance read is scoped to the fiscal year period ids', () => {
    expect(fyc).toContain('tx.accountBalance.groupBy');
    expect(fyc).toMatch(
      /financialPeriodId:\s*\{\s*in:\s*periods\.map\(\(p\) => p\.id\)\s*\}/,
    );
    // The old unscoped read must be gone for good.
    expect(fyc).not.toMatch(/accountBalance\.findMany\(/);
  });

  it('D3: no per-account "find the first matching balance row" lookup remains', () => {
    expect(fyc).not.toMatch(/balances\.find\(/);
    expect(fyc).not.toMatch(/\.find\(\(b\)\s*=>\s*b\.accountId/);
  });

  it('D2: the P&L aggregation never takes an absolute value', () => {
    // Only the retained-earnings LOSS leg may use abs(), and only to format a
    // positive magnitude. Any `totalRevenue.add(...abs())`-style aggregation is
    // the D2 defect.
    expect(fyc).not.toMatch(/totalRevenue\s*\.add\([^)]*\.abs\(\)/);
    expect(fyc).not.toMatch(/totalExpense\s*\.add\([^)]*\.abs\(\)/);
    expect(fyc).not.toMatch(/netProfitLoss/);
  });

  it('derives both profit and the closing lines from one signed map', () => {
    expect(fyc).toContain('signedNetByAccount');
    expect(fyc).toMatch(
      /for \(const net of signedNetByAccount\.values\(\)\) \{\s*profit = profit\.add\(net\)/,
    );
    expect(fyc).toMatch(/signedNetByAccount\.get\(account\.id\)/);
  });

  it('P2-C: period closing goes through the repository CAS, never a direct update', () => {
    expect(fyc).toContain('this.periodsRepository.update');
    expect(fyc).not.toMatch(/tx\.financialPeriod\.update\(/);
    expect(fyc).toMatch(/companyId,\s*\n\s*period\.rowVersion,\s*\n\s*tx,/);
  });

  it('zero profit still emits account-zeroing lines with no retained-earnings line', () => {
    expect(fyc).toMatch(/else if \(profit\.lt\(0\)\)/);
    // The RE line is added only under strict inequalities, never on the
    // zero branch.
    expect(fyc).not.toMatch(/\}\s*else\s*\{\s*\/\/ Loss: debit/);
  });
});

describe('G16-N-7 structural guards — manual journal validation', () => {
  it('create() and post() both invoke the canonical PostingValidationService.validate()', () => {
    expect(jes.match(/this\.validationService\.validate\(/g)).toHaveLength(2);

    // Ownership (404, oracle-free) is checked BEFORE the canonical validator in
    // both methods, so the validator's own account step is unreachable and can
    // never leak cross-tenant ids inside a 400 message.
    expect(jes.match(/validateAccountsBelongToCompany\(/g)).toHaveLength(2);
    expect(jes.indexOf('validateAccountsBelongToCompany')).toBeLessThan(
      jes.indexOf('this.validationService.validate('),
    );
  });

  it('post() validates the PERSISTED lines, never the DTO', () => {
    expect(jes).toContain('persistedLines');
    expect(jes).toMatch(/lines:\s*persistedLines,/);
  });

  it('the duplicated ad-hoc balance/period checks were removed from create()', () => {
    // These were the hand-rolled checks the canonical validator replaces.
    expect(jes).not.toMatch(
      /Journal entry is unbalanced: debit=\$\{totalDebit\.toString\(\)\}/,
    );
    expect(jes).not.toMatch(
      /if \(!period\) throw new NotFoundException\('Financial period not found'\)/,
    );
  });
});
