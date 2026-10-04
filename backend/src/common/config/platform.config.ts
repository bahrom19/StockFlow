import { registerAs } from '@nestjs/config';

/**
 * G16-N-4 P0-A — global resource authorization boundary.
 *
 * Platform operator identity is an IMMUTABLE, process-lifetime allowlist of
 * user ids supplied through the environment. It is deliberately NOT modelled
 * as a Permission row, a Role row, a company membership or an email address:
 *
 *   * Permission/Role rows are tenant-scoped (`Role.companyId` is mandatory)
 *     and `PermissionsSeedService.assignPermissionsToAdminRoles()` grants the
 *     whole catalog to every tenant `Admin` role, so any RBAC-backed platform
 *     flag would be self-grantable by a tenant administrator.
 *   * A company membership is tenant-scoped for the same reason.
 *   * `User.email` is tenant-writable — `PATCH /users/:id` accepts `email` in
 *     `UpdateUserDto` and is only scoped by `members.some(companyId)`, so a
 *     tenant admin can rewrite their own email to a configured operator email.
 *
 * Nothing in the application writes configuration, so this value cannot be
 * influenced by any authenticated principal at runtime.
 *
 * Fail-closed semantics: a missing, empty or malformed value yields an EMPTY
 * allowlist, which denies every platform-protected write. It never throws and
 * never blocks application startup.
 */
export interface PlatformConfig {
  /** Lower-cased, de-duplicated, deterministically sorted user ids. */
  operatorUserIds: string[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse `PLATFORM_OPERATOR_USER_IDS` into a canonical allowlist.
 *
 * Entries are trimmed, validated as UUIDs, lower-cased, de-duplicated and
 * sorted so the effective set is deterministic regardless of env formatting.
 * Invalid entries are discarded rather than throwing, because a malformed
 * value must degrade to "deny everything", never to "allow everything" and
 * never to an application that cannot boot.
 */
export function parseOperatorUserIds(raw: string | undefined): string[] {
  if (!raw) return [];

  const unique = new Set<string>();
  for (const candidate of raw.split(',')) {
    const value = candidate.trim();
    if (!value) continue;
    if (!UUID_PATTERN.test(value)) continue;
    unique.add(value.toLowerCase());
  }

  return Array.from(unique).sort();
}

export const platformConfig = registerAs(
  'platform',
  (): PlatformConfig => ({
    operatorUserIds: parseOperatorUserIds(
      process.env.PLATFORM_OPERATOR_USER_IDS,
    ),
  }),
);
