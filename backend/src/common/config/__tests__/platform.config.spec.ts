import { parseOperatorUserIds, PlatformConfig } from '../platform.config';

/**
 * G16-N-4 P0-A — platform operator allowlist parsing.
 *
 * The allowlist is the ONLY source of platform authority, so its parsing must
 * be deterministic and fail closed: anything that is not an unambiguous UUID is
 * discarded, never coerced. A malformed value must never widen access, and it
 * must never throw (an absent allowlist has to mean "protected writes denied",
 * not "the application cannot boot").
 */
describe('platformConfig — PLATFORM_OPERATOR_USER_IDS parsing (G16-N-4 P0-A)', () => {
  const U1 = '11111111-1111-4111-8111-111111111111';
  const U2 = '22222222-2222-4222-8222-222222222222';
  const U3 = '33333333-3333-4333-8333-333333333333';

  it('returns an empty allowlist when the variable is missing', () => {
    expect(parseOperatorUserIds(undefined)).toEqual([]);
  });

  it('returns an empty allowlist for an empty or whitespace-only value', () => {
    expect(parseOperatorUserIds('')).toEqual([]);
    expect(parseOperatorUserIds('   ')).toEqual([]);
    expect(parseOperatorUserIds(' , ,, ')).toEqual([]);
  });

  it('parses a single uuid', () => {
    expect(parseOperatorUserIds(U1)).toEqual([U1]);
  });

  it('parses a comma-separated list', () => {
    expect(parseOperatorUserIds(`${U1},${U2},${U3}`)).toEqual([U1, U2, U3]);
  });

  it('trims surrounding whitespace on every entry', () => {
    expect(parseOperatorUserIds(`  ${U1} , ${U2}  `)).toEqual([U1, U2]);
  });

  it('discards malformed entries instead of throwing', () => {
    expect(parseOperatorUserIds(`not-a-uuid,${U1},12345,admin@x.com`)).toEqual([
      U1,
    ]);
  });

  it('yields an empty allowlist when nothing is a valid uuid', () => {
    expect(parseOperatorUserIds('not-a-uuid,admin@x.com,42')).toEqual([]);
  });

  it('de-duplicates repeated ids', () => {
    expect(parseOperatorUserIds(`${U1},${U2},${U1}`)).toEqual([U1, U2]);
  });

  it('normalises case so matching is deterministic', () => {
    expect(parseOperatorUserIds(U1.toUpperCase())).toEqual([U1]);
  });

  it('produces a deterministic order regardless of input ordering', () => {
    expect(parseOperatorUserIds(`${U3},${U1},${U2}`)).toEqual(
      parseOperatorUserIds(`${U1},${U2},${U3}`),
    );
  });

  it('exposes operatorUserIds on the config namespace', () => {
    const previous = process.env.PLATFORM_OPERATOR_USER_IDS;
    process.env.PLATFORM_OPERATOR_USER_IDS = `${U2}, ${U1}`;
    try {
      const { platformConfig } = require('../platform.config') as {
        platformConfig: () => PlatformConfig;
      };
      const config: PlatformConfig = platformConfig();
      expect(config.operatorUserIds).toEqual([U1, U2]);
    } finally {
      if (previous === undefined) delete process.env.PLATFORM_OPERATOR_USER_IDS;
      else process.env.PLATFORM_OPERATOR_USER_IDS = previous;
    }
  });
});
