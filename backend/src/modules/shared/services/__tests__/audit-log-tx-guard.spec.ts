/**
 * G16-N-5 — static guard: an `AuditLogService.log` call inside a Prisma
 * interactive transaction must pass the transaction client.
 *
 * Why a source-scan guard rather than an ESLint rule: `backend/eslint.config.js`
 * is an ESLint 9 flat config that registers only `@typescript-eslint` and
 * `prettier` — there is no local-rules infrastructure, and introducing a plugin
 * package for one invariant is disproportionate. This repository already
 * establishes source-scanning guard tests as its convention (see
 * `reconciliation-runner-actor-guard.spec.ts`, `platform-migrations.spec.ts`),
 * so this follows the existing pattern with no new dependency and no new tooling.
 *
 * The invariant it locks:
 *
 *   `await auditLog.log(entry)` inside `$transaction(async (tx) => …)`
 *        → the AuditLog INSERT autocommits on the ROOT client
 *        → it survives a rollback of the business transaction
 *        → a false audit record (G16-N-5's P2 defect).
 *
 * The scan deliberately ignores:
 *  - the `$transaction([ … ])` array-batch form (no callback, nothing to thread);
 *  - calls that are genuinely outside any transaction — the two legitimate
 *    non-transactional callers are `LoyaltyService.enroll` (auto-creates the
 *    account outside any transaction) and `InventoryFinanceHandler.logSkipBestEffort`
 *    (G16-F observable-skip, which exists precisely because no transaction is
 *    available). Both are asserted below so they cannot be "fixed" by accident;
 *  - spec files.
 *
 * Line numbers are never asserted against a hard-coded list: the guard derives
 * everything from the source, so edits that shift lines cannot make it lie.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '../../../../');

interface Violation {
  file: string;
  line: number;
  text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

/** `lines[i]` without the `noUncheckedIndexedAccess` undefined branch. */
function line(lines: string[], i: number): string {
  return lines[i] ?? '';
}

/**
 * Count top-level arguments of the call whose `(` opens at `openCol` on
 * `startLine`. Returns `null` when the parens never balance.
 */
function countArgs(
  lines: string[],
  startLine: number,
  openCol: number,
): number | null {
  let depth = 0;
  let sawContent = false;
  let args = 0;
  for (let r = startLine; r < lines.length; r++) {
    const text = line(lines, r);
    const from = r === startLine ? openCol : 0;
    for (let c = from; c < text.length; c++) {
      const ch = text.charAt(c);
      if (ch === '(' || ch === '{' || ch === '[') {
        depth++;
        if (depth === 1) sawContent = true;
      } else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) return sawContent ? args + 1 : 0;
      } else if (ch === ',' && depth === 1) {
        args++;
      }
    }
  }
  return null;
}

/** Line ranges (0-based, inclusive) covered by interactive `$transaction` callbacks. */
function interactiveTransactionRanges(
  lines: string[],
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!line(lines, i).includes('$transaction(')) continue;
    // Array-batch form: `$transaction([ … ])` — no callback, nothing to thread.
    if (/\$\(\s*\[/.test(lines.slice(i, i + 3).join(' '))) continue;
    let depth = 0;
    let started = false;
    let end = -1;
    for (let j = i; j < lines.length; j++) {
      for (const ch of line(lines, j)) {
        if (ch === '{') {
          depth++;
          started = true;
        } else if (ch === '}') {
          depth--;
          if (started && depth === 0) {
            end = j;
            break;
          }
        }
      }
      if (end !== -1) break;
    }
    if (end !== -1) ranges.push([i, end]);
  }
  return ranges;
}

describe('G16-N-5 guard — AuditLogService.log inside a transaction must receive tx', () => {
  const files = walk(SRC_ROOT);
  const violations: Violation[] = [];
  let inTransactionAuditCalls = 0;
  const nonTransactionalAuditCalls: Violation[] = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const txRanges = interactiveTransactionRanges(lines);

    for (let i = 0; i < lines.length; i++) {
      const m = line(lines, i).match(
        /\b(?:this\.)?auditLog(?:Service)?\.log\s*\(/,
      );
      if (!m || m.index === undefined) continue;

      const openCol = line(lines, i).indexOf('(', m.index + m[0].length - 1);
      const argCount = countArgs(lines, i, openCol);
      if (argCount === null) continue; // unparseable — skip rather than false-alarm

      const inTx = txRanges.some(([a, b]) => i >= a && i <= b);
      const record: Violation = {
        file: file.replace(SRC_ROOT, ''),
        line: i + 1,
        text: line(lines, i).trim().slice(0, 90),
      };

      if (inTx) {
        inTransactionAuditCalls++;
        if (argCount < 2) violations.push(record);
      } else if (argCount < 2) {
        nonTransactionalAuditCalls.push(record);
      }
    }
  }

  it('scans a non-trivial number of production files', () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it('finds AuditLog calls inside interactive transactions', () => {
    expect(inTransactionAuditCalls).toBeGreaterThan(50);
  });

  it('NO AuditLog call inside an interactive transaction omits the transaction client', () => {
    expect(violations).toEqual([]);
  });

  it('keeps exactly the two legitimate non-transactional callers', () => {
    // These are intentionally root-Prisma: `logSkipBestEffort` runs precisely
    // when no transaction exists (G16-F observable-skip), and `enroll` creates
    // the loyalty account outside any transaction. If a THIRD one appears, a
    // caller has started auditing outside a transaction and needs a decision.
    const fileSet = nonTransactionalAuditCalls.map((v) => v.file).sort();
    expect(fileSet).toEqual([
      'modules/crm/services/loyalty.service.ts',
      'modules/inventory/events/finance-integration.handler.ts',
    ]);
  });
});
