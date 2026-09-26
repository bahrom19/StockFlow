import {
  hasIntegrationDatabase,
  integrationDatabaseUrl,
} from '../../../infrastructure/idempotency/__tests__/integration-env';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from '../../auth/repositories/auth.repository';
import { AuthService } from '../../auth/services/auth.service';
import { RolesRepository } from '../../rbac/repositories/roles.repository';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { UsersRepository } from '../repositories/users.repository';
import { UsersService } from '../services/users.service';

/**
 * G16-B-01 provisioning integration tests against a REAL PostgreSQL database.
 *
 * Run with:
 *   DATABASE_URL=postgresql://... npx jest --config jest.integration.config.js \
 *     src/modules/users
 *
 * Without DATABASE_URL the suite is skipped (same convention as the rest of
 * the repo's integration lane). All rows use unique per-run emails and are
 * removed in afterAll.
 *
 * Covers: I (provision → member → login), full J (rotation preserves
 * membership, old password dies), K (concurrent duplicate → single user),
 * L (audit failure rolls back user + member — no orphan).
 */

const databaseUrl = integrationDatabaseUrl;
const hasDb = hasIntegrationDatabase;
/** Runtime skip: `describe.skip` when no database is configured. */
const describeDb = hasDb ? describe : describe.skip;

describeDb('Users provisioning (G16-B-01 integration — real PostgreSQL)', () => {
  let prisma: any;
  let usersService: UsersService;
  let authService: AuthService;
  let companyId: string;
  let actorCtx: { userId: string; companyId: string; roles: string[]; email: string };

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const emails = {
    actor: `g16b01-actor-${suffix}@example.test`,
    provisioned: `g16b01-user-${suffix}@example.test`,
    concurrent: `g16b01-race-${suffix}@example.test`,
    rolledBack: `g16b01-rollback-${suffix}@example.test`,
  };
  const allEmails = Object.values(emails);

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const prismaLike = prisma as unknown as PrismaService;

    const usersRepo = new UsersRepository(prismaLike);
    const audit = new AuditLogService(prismaLike);
    const configStub = {
      get: (key: string) => {
        if (key === 'jwt.secret' || key === 'jwt.refreshSecret') {
          return 'g16b01-test-secret';
        }
        return undefined;
      },
    } as any;

    usersService = new UsersService(usersRepo, prismaLike, audit, configStub);

    const authRepo = new AuthRepository(prismaLike);
    const rolesRepo = new RolesRepository(prismaLike);
    const jwtService = new JwtService({ secret: 'g16b01-test-secret' } as any);
    const emailStub = { sendPasswordResetEmail: jest.fn() } as any;
    authService = new AuthService(
      authRepo,
      jwtService,
      configStub,
      prismaLike,
      rolesRepo,
      emailStub,
      {} as any,
    );

    const company = await prisma.company.create({
      data: {
        name: `G16-B-01 Test Co ${suffix}`,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    companyId = company.id;

    const actor = await prisma.user.create({
      data: {
        email: emails.actor,
        passwordHash: await bcrypt.hash('ActorPass123', 4),
        status: 'ACTIVE',
        isActive: true,
      },
    });
    await prisma.companyMember.create({
      data: { userId: actor.id, companyId },
    });
    actorCtx = {
      userId: actor.id,
      companyId,
      roles: ['Admin'],
      email: emails.actor,
    };
  }, 60000);

  afterAll(async () => {
    if (!prisma) return;
    const users = await prisma.user.findMany({
      where: { email: { in: allEmails } },
      select: { id: true },
    });
    const ids = users.map((u: any) => u.id);
    if (ids.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ companyId }, { userId: { in: ids } }],
        },
      });
      await prisma.companyMember.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    } else {
      await prisma.auditLog.deleteMany({ where: { companyId } });
    }
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  }, 60000);

  it('I: provisioned user gets a CompanyMember and can log in', async () => {
    const created = await usersService.create(
      { email: emails.provisioned, password: 'StrongPass123' } as any,
      actorCtx,
    );

    expect(created).not.toHaveProperty('passwordHash');

    const member = await prisma.companyMember.findFirst({
      where: { companyId, user: { email: emails.provisioned } },
    });
    expect(member).not.toBeNull();

    const stored = await prisma.user.findUnique({
      where: { email: emails.provisioned },
    });
    expect(stored.passwordHash).not.toBe('StrongPass123');
    expect(stored.passwordHash.startsWith('$2b$12$')).toBe(true);

    const login = await authService.login({
      email: emails.provisioned,
      password: 'StrongPass123',
    } as any);
    expect(login.accessToken).toBeDefined();
    expect(login.user.companyId).toBe(companyId);
  }, 30000);

  it('J: password rotation preserves membership and kills the old password', async () => {
    const stored = await prisma.user.findUnique({
      where: { email: emails.provisioned },
    });
    const before = await prisma.companyMember.count({
      where: { userId: stored.id },
    });

    const updated = await usersService.update(
      stored.id,
      { password: 'RotatedPass456' } as any,
      actorCtx,
    );
    expect(updated).not.toHaveProperty('passwordHash');

    const after = await prisma.companyMember.count({
      where: { userId: stored.id },
    });
    expect(after).toBe(before);

    await expect(
      authService.login({ email: emails.provisioned, password: 'StrongPass123' } as any),
    ).rejects.toThrow();
    const login = await authService.login({
      email: emails.provisioned,
      password: 'RotatedPass456',
    } as any);
    expect(login.accessToken).toBeDefined();
  }, 30000);

  it('K: concurrent duplicate provisioning yields exactly one user', async () => {
    const attempt = () =>
      usersService.create(
        { email: emails.concurrent, password: 'StrongPass123' } as any,
        actorCtx,
      );
    const [first, second] = await Promise.allSettled([attempt(), attempt()]);

    const successes = [first, second].filter((r) => r.status === 'fulfilled');
    const failures = [first, second].filter((r) => r.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const count = await prisma.user.count({
      where: { email: emails.concurrent },
    });
    expect(count).toBe(1);
    const memberCount = await prisma.companyMember.count({
      where: { companyId, user: { email: emails.concurrent } },
    });
    expect(memberCount).toBe(1);
  }, 30000);

  it('L: audit failure rolls back user + member (no orphan)', async () => {
    const audit = (usersService as any).auditLog;
    const originalLog = audit.log.bind(audit);
    audit.log = jest.fn().mockRejectedValue(new Error('audit store down'));

    await expect(
      usersService.create(
        { email: emails.rolledBack, password: 'StrongPass123' } as any,
        actorCtx,
      ),
    ).rejects.toThrow('audit store down');

    audit.log = originalLog;

    const user = await prisma.user.findUnique({
      where: { email: emails.rolledBack },
    });
    expect(user).toBeNull();
    const memberCount = await prisma.companyMember.count({
      where: { companyId, user: { email: emails.rolledBack } },
    });
    expect(memberCount).toBe(0);
  }, 30000);
});
