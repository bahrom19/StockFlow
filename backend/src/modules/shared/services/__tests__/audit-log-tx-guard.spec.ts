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
 * How the scan decides what a transaction is (G16-N-6). A `codeMask` marks
 * every character that is real code, so:
 *  - `$transaction([ … ])` is excluded because the first non-whitespace
 *    character after `(` is `[` — an array batch has no callback to thread;
 *  - a `$transaction(` appearing only inside a comment or a string literal is
 *    not a call site and creates no range;
 *  - a range ends at the delimiter that closes the CALL, counted over code
 *    characters only, so nested braces, object literals and expression-bodied
 *    callbacks (`(tx) => work(tx)`) all bound correctly.
 * This is a lexical scan, not a parser: it resolves no types and no aliases.
 *
 * The scan deliberately ignores:
 *  - calls that are genuinely outside any transaction — the two legitimate
 *    non-transactional callers are `LoyaltyService.getOrCreateAccount`
 *    (auto-creates the account outside any transaction) and
 *    `InventoryFinanceHandler.logSkipBestEffort` (G16-F observable-skip, which
 *    exists precisely because no transaction is available). Both are asserted
 *    below so they cannot be "fixed" by accident;
 *  - spec files.
 *
 * Known limitation, asserted as such by a regression test: a call reached
 * through an alias (`const al = this.auditLog; al.log(…)`) is NOT detected.
 *
 * Line numbers are never asserted against a hard-coded list: the guard derives
 * everything from the source, so edits that shift lines cannot make it lie.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '../../../../');

const TX_MARKER = '$transaction(';

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

/** `starts[i] ?? 0` — offsets are dense, so an out-of-range read means zero. */
function offset(starts: number[], i: number): number {
  return starts[i] ?? 0;
}

/** Byte offset at which each line starts. */
function lineStarts(src: string): number[] {
  const out = [0];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '\n') out.push(i + 1);
  }
  return out;
}

/** 1-based line number containing the byte `at`. */
function lineOf(starts: number[], at: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offset(starts, mid) <= at) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * Per-character mask: `1` for real code, `0` for comments, string literals and
 * template-literal text. `${ … }` substitutions are treated as code.
 *
 * A lexical pass, not a parser. It does not know about regex literals: a
 * regex such as `/'/g` can make a later quote look like an unterminated
 * string. Measured blast radius today is one line containing no transaction.
 */
function codeMask(src: string): Uint8Array {
  const mask = new Uint8Array(src.length);
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i++;
          break;
        }
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            if (depth === 0) {
              i++;
              break;
            }
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }
    mask[i] = 1;
    i++;
  }
  return mask;
}

interface CallRange {
  at: number;
  end: number;
  form: 'INTERACTIVE' | 'ARRAY';
}

/**
 * Every `$transaction(` call site in code position, classified by its first
 * argument and bounded by the delimiter that closes the call.
 *
 * `end` is the offset of the closing delimiter, or -1 when none balances.
 */
function callRanges(src: string): CallRange[] {
  const mask = codeMask(src);
  const out: CallRange[] = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf(TX_MARKER, from);
    if (at === -1) break;
    from = at + TX_MARKER.length;
    // A `$transaction(` inside a comment or string is not a call site.
    if (mask[at] !== 1) continue;
    const open = at + TX_MARKER.length - 1;
    let probe = open + 1;
    while (probe < src.length && /\s/.test(src[probe] ?? '')) probe++;
    // `[` first => array batch: no callback, nothing to thread.
    const form: CallRange['form'] =
      src[probe] === '[' ? 'ARRAY' : 'INTERACTIVE';

    let depth = 0;
    let sawContent = false;
    let end = -1;
    for (let i = open; i < src.length; i++) {
      if (mask[i] !== 1) continue;
      const ch = src[i];
      if (ch === '(' || ch === '{' || ch === '[') {
        depth++;
        if (depth === 1) sawContent = true;
      } else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0 && sawContent) {
          end = i;
          break;
        }
      }
    }
    out.push({ at, end, form });
  }
  return out;
}

/**
 * Count top-level arguments of the call whose `(` opens at `openOffset`.
 * Only characters marked as code are considered, so a comma inside a string
 * argument is not mistaken for a separator. Returns `null` when the
 * delimiters never balance.
 */
function countArgs(
  src: string,
  mask: Uint8Array,
  openOffset: number,
): number | null {
  let depth = 0;
  let sawContent = false;
  let args = 0;
  for (let i = openOffset; i < src.length; i++) {
    if (mask[i] !== 1) continue;
    const ch = src[i];
    if (ch === '(' || ch === '{' || ch === '[') {
      depth++;
      if (depth === 1) sawContent = true;
    } else if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return sawContent ? args + 1 : 0;
    } else if (ch === ',' && depth === 1) args++;
  }
  return null;
}

interface ScanResult {
  interactive: number;
  arrayForm: number;
  inTransactionCalls: number;
  violations: Violation[];
  nonTransactional: Violation[];
  /** Interactive ranges with no balancing delimiter — should never happen. */
  unbounded: number;
}

/** The whole guard pipeline over one source string. */
function scanSource(src: string, fileLabel: string): ScanResult {
  const mask = codeMask(src);
  const starts = lineStarts(src);
  const lines = src.split('\n');

  const interactive: Array<[number, number]> = [];
  let interactiveForms = 0;
  let arrayForm = 0;
  let unbounded = 0;
  for (const call of callRanges(src)) {
    if (call.form === 'ARRAY') {
      arrayForm++;
      continue;
    }
    interactiveForms++;
    if (call.end === -1) {
      unbounded++;
      continue;
    }
    interactive.push([lineOf(starts, call.at), lineOf(starts, call.end)]);
  }

  const violations: Violation[] = [];
  const nonTransactional: Violation[] = [];
  let inTransactionCalls = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = line(lines, i).match(
      /\b(?:this\.)?auditLog(?:Service)?\.log\s*\(/,
    );
    if (!m || m.index === undefined) continue;

    const openCol = line(lines, i).indexOf('(', m.index + m[0].length - 1);
    if (openCol === -1) continue;
    const argCount = countArgs(src, mask, offset(starts, i) + openCol);
    if (argCount === null) continue; // unparseable — skip rather than false-alarm

    const row = i + 1;
    const record: Violation = {
      file: fileLabel,
      line: row,
      text: line(lines, i).trim().slice(0, 90),
    };
    const inTx = interactive.some(([a, b]) => row >= a && row <= b);
    if (inTx) {
      inTransactionCalls++;
      if (argCount < 2) violations.push(record);
    } else if (argCount < 2) {
      nonTransactional.push(record);
    }
  }

  return {
    interactive: interactiveForms,
    arrayForm,
    inTransactionCalls,
    violations,
    nonTransactional,
    unbounded,
  };
}

describe('G16-N-5 guard — AuditLogService.log inside a transaction must receive tx', () => {
  const files = walk(SRC_ROOT);
  const violations: Violation[] = [];
  let inTransactionAuditCalls = 0;
  const nonTransactionalAuditCalls: Violation[] = [];
  let interactiveForms = 0;
  let arrayFormSites = 0;
  let unboundedRanges = 0;

  for (const file of files) {
    const label = file.replace(SRC_ROOT, '');
    const result = scanSource(readFileSync(file, 'utf8'), label);
    interactiveForms += result.interactive;
    arrayFormSites += result.arrayForm;
    unboundedRanges += result.unbounded;
    inTransactionAuditCalls += result.inTransactionCalls;
    violations.push(...result.violations);
    nonTransactionalAuditCalls.push(...result.nonTransactional);
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

  // ── G16-N-6 regressions ────────────────────────────────────────────────
  it('R1 excludes the array-form $transaction([ ... ]) from interactive ranges', () => {
    const src = [
      'const [rows] = await this.prisma.$transaction([',
      '  this.repo.create({ a: 1 }),',
      ']);',
      'await this.auditLog.log({ companyId });',
    ].join('\n');
    const result = scanSource(src, 'fixture-array-form');
    expect(result.arrayForm).toBe(1);
    expect(result.interactive).toBe(0);
    // The audit call below the batch is NOT inside a transaction.
    expect(result.violations).toEqual([]);
    expect(result.nonTransactional).toHaveLength(1);
  });

  it('R2 finds exactly one interactive range for $transaction(async (tx) => …)', () => {
    const src = [
      'await this.prisma.$transaction(async (tx) => {',
      '  await this.repo.save(tx);',
      '});',
    ].join('\n');
    const result = scanSource(src, 'fixture-interactive');
    expect(result.interactive).toBe(1);
    expect(result.arrayForm).toBe(0);
    expect(result.unbounded).toBe(0);
  });

  it('R3 flags an in-transaction auditLog.log that omits the transaction client', () => {
    const src = [
      'await this.prisma.$transaction(async (tx) => {',
      '  await this.repo.save(tx);',
      '  await this.auditLog.log({',
      '    companyId,',
      '    userId,',
      '    entityType: "T",',
      '  });',
      '});',
    ].join('\n');
    const result = scanSource(src, 'fixture-missing-tx');
    expect(result.inTransactionCalls).toBe(1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.file).toBe('fixture-missing-tx');
  });

  it('R4 accepts an in-transaction auditLog.log that receives tx', () => {
    const src = [
      'await this.prisma.$transaction(async (tx) => {',
      '  await this.repo.save(tx);',
      '  await this.auditLog.log({ companyId, userId }, tx);',
      '});',
    ].join('\n');
    const result = scanSource(src, 'fixture-with-tx');
    expect(result.inTransactionCalls).toBe(1);
    expect(result.violations).toEqual([]);
  });

  it('R5 ignores $transaction( inside comments and string literals', () => {
    const block = [
      '/**',
      ' * await prisma.$transaction(async (tx) => {',
      ' */',
      '// prisma.$transaction(async (tx) => {',
      'const sample = "prisma.$transaction(async (tx) => {";',
      'await this.auditLog.log({ companyId });',
    ].join('\n');
    const result = scanSource(block, 'fixture-not-a-call-site');
    expect(result.interactive).toBe(0);
    expect(result.arrayForm).toBe(0);
    expect(result.unbounded).toBe(0);
    // Nothing was treated as a transaction, so the call is non-transactional.
    expect(result.inTransactionCalls).toBe(0);
    expect(result.nonTransactional).toHaveLength(1);
  });

  it('R6 pins the production corpus shape (121 / 23 / 0 spurious)', () => {
    // Exact counts on purpose: before G16-N-6 the array-form exemption was a
    // dead regex, so all 23 array batches were counted as interactive and two
    // JSDoc occurrences produced spurious ranges. Do NOT loosen these to a
    // lower bound — that would hide a regression of the same defect.
    expect(interactiveForms).toBe(121);
    expect(arrayFormSites).toBe(23);
    expect(unboundedRanges).toBe(0);
    expect(violations).toEqual([]);
    expect(inTransactionAuditCalls).toBe(86);
  });

  it('R7 documents the alias gap: aliased receivers remain undetected', () => {
    const src = [
      'await this.prisma.$transaction(async (tx) => {',
      '  const al = this.auditLog;',
      '  await al.log({ companyId, userId });',
      '});',
    ].join('\n');
    const result = scanSource(src, 'fixture-alias');
    // The transaction IS found, but the aliased call is invisible to the
    // receiver pattern. Accepted limitation — asserted so it stays a
    // documented decision rather than a silent hole.
    expect(result.interactive).toBe(1);
    expect(result.violations).toEqual([]);
    expect(result.inTransactionCalls).toBe(0);
  });
});
