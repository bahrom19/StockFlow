import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../repositories/users.repository';
import { UsersService } from '../services/users.service';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { UserStatus } from '@prisma/client';

/**
 * G16-B-01 security regression suite.
 *
 * Covers: passwordHash rejected on the wire (A/B), server-side bcrypt (C/E/Q),
 * weak-password policy (D), no hash disclosure (F), CompanyMember provisioning
 * (G), no roleId (H), membership-preserving rotation (J), concurrent duplicate
 * (K), rollback propagation (L), client companyId rejection (M), scoping (N/P).
 *
 * DB-backed provisioning → login is covered by
 * users-provisioning.integration.spec.ts (I + full J/K/L).
 */
describe('UsersService (G16-B-01)', () => {
  let service: UsersService;
  let mockRepo: jest.Mocked<UsersRepository>;
  let mockAudit: { log: jest.Mock };
  let mockConfig: { get: jest.Mock };
  const mockTx = {};

  const actor = {
    userId: 'actor-1',
    companyId: 'comp-1',
    roles: ['Admin'],
    email: 'actor@test.com',
  };

  const prismaUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'new@test.com',
    firstName: 'John',
    lastName: 'Doe',
    status: UserStatus.ACTIVE,
    isActive: true,
    phone: null,
    position: null,
    passwordHash: '$2b$12$testhash',
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockRepo = {
      findByEmailGlobal: jest.fn(),
      create: jest.fn(),
      createCompanyMember: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;
    mockAudit = { log: jest.fn() };
    mockConfig = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepo },
        {
          provide: PrismaService,
          useValue: { $transaction: jest.fn((cb: any) => cb(mockTx)) },
        },
        { provide: AuditLogService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ─────────────────────────────────────────────
  // CREATE — provisioning
  // ─────────────────────────────────────────────
  describe('create', () => {
    it('hashes password server-side, creates member + audit, strips hash (C/F/G/Q)', async () => {
      const plaintext = 'StrongPass123';
      mockRepo.findByEmailGlobal.mockResolvedValue(null);
      let storedHash = '';
      mockRepo.create.mockImplementation((async (data: any) => {
        storedHash = data.passwordHash;
        return prismaUser({ email: data.email, passwordHash: data.passwordHash });
      }) as any);
      mockRepo.createCompanyMember.mockResolvedValue({ id: 'member-1' } as any);
      mockRepo.findById.mockResolvedValue(prismaUser() as any);

      const result = await service.create(
        { email: 'new@test.com', password: plaintext } as CreateUserDto,
        actor,
      );

      // Q: stored value is a real bcrypt hash of the plaintext, not the input.
      expect(storedHash).not.toBe(plaintext);
      await expect(bcrypt.compare(plaintext, storedHash)).resolves.toBe(true);
      // C: plaintext never persisted.
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@test.com' }),
        mockTx,
      );
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ password: expect.anything() }),
        expect.anything(),
      );
      // G: member created with JWT companyId inside the same tx.
      expect(mockRepo.createCompanyMember).toHaveBeenCalledWith(
        'user-1',
        'comp-1',
        mockTx,
      );
      // Audit CREATE inside the same tx, without credential material.
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'comp-1',
          userId: 'actor-1',
          entityType: 'User',
          action: 'CREATE',
        }),
        mockTx,
      );
      const auditArg = mockAudit.log.mock.calls[0][0];
      expect(JSON.stringify(auditArg)).not.toContain(plaintext);
      // F: response carries no hash.
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('new@test.com');
    });

    it('uses bcrypt cost 12 when unconfigured (E default)', async () => {
      mockConfig.get.mockReturnValue(undefined);
      let storedHash = '';
      mockRepo.findByEmailGlobal.mockResolvedValue(null);
      mockRepo.create.mockImplementation((async (data: any) => {
        storedHash = data.passwordHash;
        return prismaUser({ passwordHash: data.passwordHash });
      }) as any);
      mockRepo.createCompanyMember.mockResolvedValue({ id: 'm' } as any);
      mockRepo.findById.mockResolvedValue(prismaUser() as any);

      await service.create(
        { email: 'new@test.com', password: 'StrongPass123' } as CreateUserDto,
        actor,
      );

      // Real bcrypt output carries the cost in its prefix.
      expect(storedHash.startsWith('$2b$12$')).toBe(true);
    });

    it('uses configured bcrypt cost (E configured)', async () => {
      mockConfig.get.mockImplementation((key: string) =>
        key === 'auth.bcryptRounds' ? 4 : undefined,
      );
      let storedHash = '';
      mockRepo.findByEmailGlobal.mockResolvedValue(null);
      mockRepo.create.mockImplementation((async (data: any) => {
        storedHash = data.passwordHash;
        return prismaUser({ passwordHash: data.passwordHash });
      }) as any);
      mockRepo.createCompanyMember.mockResolvedValue({ id: 'm' } as any);
      mockRepo.findById.mockResolvedValue(prismaUser() as any);

      await service.create(
        { email: 'new@test.com', password: 'StrongPass123' } as CreateUserDto,
        actor,
      );

      expect(storedHash.startsWith('$2b$04$')).toBe(true);
    });

    it('throws ConflictException when email already exists globally', async () => {
      mockRepo.findByEmailGlobal.mockResolvedValue({ id: 'existing' } as any);
      await expect(
        service.create(
          { email: 'existing@test.com', password: 'StrongPass123' } as any,
          actor,
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('propagates P2002 on concurrent duplicate (K race backstop)', async () => {
      mockRepo.findByEmailGlobal.mockResolvedValue(null);
      const p2002 = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      mockRepo.create
        .mockResolvedValueOnce(prismaUser() as any)
        .mockRejectedValueOnce(p2002);
      mockRepo.createCompanyMember.mockResolvedValue({ id: 'm' } as any);
      mockRepo.findById.mockResolvedValue(prismaUser() as any);

      const dto = (n: number) =>
        ({ email: `race${n}@test.com`, password: 'StrongPass123' }) as CreateUserDto;
      // Order-independent: whichever bcrypt finishes first wins the mock's
      // success slot. Assert SET semantics, never positional order (PA-01).
      const results = await Promise.allSettled([
        service.create(dto(1), actor),
        service.create(dto(2), actor),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const reason = (rejected[0] as PromiseRejectedResult).reason as any;
      expect(reason?.code).toBe('P2002');
    });

    it('fails closed when member creation fails: no audit, error propagates (L)', async () => {
      mockRepo.findByEmailGlobal.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(prismaUser() as any);
      mockRepo.createCompanyMember.mockRejectedValue(
        new Error('member write failed'),
      );

      await expect(
        service.create(
          { email: 'new@test.com', password: 'StrongPass123' } as CreateUserDto,
          actor,
        ),
      ).rejects.toThrow('member write failed');
      // Audit must not be written when provisioning cannot complete.
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // UPDATE — rotation
  // ─────────────────────────────────────────────
  describe('update', () => {
    const existing = () => prismaUser({ id: 'user-1', rowVersion: 3 });

    it('rotates password server-side without touching membership/roles (J)', async () => {
      mockRepo.findById.mockResolvedValue(existing() as any);
      let written: any;
      mockRepo.update.mockImplementation((async (_id: any, data: any) => {
        written = data;
        return prismaUser({ passwordHash: data.passwordHash });
      }) as any);

      const result = await service.update(
        'user-1',
        { password: 'NewStrong123' } as UpdateUserDto,
        actor,
      );

      expect(written.passwordHash).toBeDefined();
      expect(written.passwordHash).not.toBe('NewStrong123');
      await expect(
        bcrypt.compare('NewStrong123', written.passwordHash),
      ).resolves.toBe(true);
      expect(written).not.toHaveProperty('password');
      // Membership/roles untouched on password rotation.
      expect(mockRepo.createCompanyMember).not.toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'user-1',
        written,
        'comp-1',
        3,
        mockTx,
      );
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('updates scalar fields without password', async () => {
      mockRepo.findById.mockResolvedValue(existing() as any);
      mockRepo.update.mockResolvedValue(prismaUser() as any);

      await service.update(
        'user-1',
        { firstName: 'New' } as UpdateUserDto,
        actor,
      );

      const written = mockRepo.update.mock.calls[0]![1];
      expect(written).toEqual({ firstName: 'New' });
    });

    it('throws ConflictException on duplicate email', async () => {
      mockRepo.findById.mockResolvedValue(existing() as any);
      mockRepo.findByEmail.mockResolvedValue({ id: 'user-2' } as any);

      await expect(
        service.update('user-1', { email: 'user-2@test.com' } as any, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('denies foreign-company update (N)', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.update('user-1', { firstName: 'X' } as any, actor),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // READ PATHS — no hash disclosure (F)
  // ─────────────────────────────────────────────
  describe('read paths', () => {
    it('findAll strips passwordHash', async () => {
      mockRepo.findAll.mockResolvedValue([prismaUser()] as any);
      const result = await service.findAll(actor);
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(mockRepo.findAll).toHaveBeenCalledWith('comp-1');
    });

    it('findById strips passwordHash', async () => {
      mockRepo.findById.mockResolvedValue(prismaUser() as any);
      const result = await service.findById('user-1', actor);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('UserEntity.fromPrisma never serializes passwordHash', () => {
      const entity = UserEntity.fromPrisma(prismaUser() as any);
      expect(entity).not.toHaveProperty('passwordHash');
    });
  });

  // ─────────────────────────────────────────────
  // WIRE CONTRACT — real ValidationPipe (A/B/D/H/M)
  // ─────────────────────────────────────────────
  describe('DTO wire contract (real ValidationPipe, mirrors main.ts)', () => {
    // Identical options to app.useGlobalPipes in main.ts.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    const transformCreate = (body: Record<string, unknown>) =>
      pipe.transform(body, { type: 'body', metatype: CreateUserDto });
    const transformUpdate = (body: Record<string, unknown>) =>
      pipe.transform(body, { type: 'body', metatype: UpdateUserDto });

    it('A: rejects passwordHash on POST /users with 400', async () => {
      await expect(
        transformCreate({
          email: 'evil@test.com',
          passwordHash: '$2b$04$attackerknownhash',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('B: rejects passwordHash on PATCH /users/:id with 400', async () => {
      await expect(
        transformUpdate({ passwordHash: '$2b$04$attackerknownhash' }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['too short', 'Aa1'],
      ['too long', `Aa1${'x'.repeat(126)}`],
      ['missing lowercase', 'UPPERCASE123'],
      ['missing uppercase', 'lowercase123'],
      ['missing digit', 'NoDigitsHere'],
    ])('D: rejects weak password (%s)', async (_label, password) => {
      await expect(
        transformCreate({ email: 'u@test.com', password }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        transformUpdate({ password }),
      ).rejects.toThrow(BadRequestException);
    });

    it('D: accepts policy-compliant password', async () => {
      const created = (await transformCreate({
        email: 'u@test.com',
        password: 'StrongPass123',
      })) as CreateUserDto;
      expect(created.password).toBe('StrongPass123');
      const updated = (await transformUpdate({
        password: 'NewStrong123',
      })) as UpdateUserDto;
      expect(updated.password).toBe('NewStrong123');
    });

    it('H: rejects roleId on POST /users (no role assignment in B-01)', async () => {
      await expect(
        transformCreate({
          email: 'u@test.com',
          password: 'StrongPass123',
          roleId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('M: rejects client-supplied companyId (JWT is authoritative)', async () => {
      await expect(
        transformCreate({
          email: 'u@test.com',
          password: 'StrongPass123',
          companyId: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
