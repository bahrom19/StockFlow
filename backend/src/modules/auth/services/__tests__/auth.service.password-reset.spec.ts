import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../../repositories/auth.repository';
import { RolesRepository } from '../../../rbac/repositories/roles.repository';
import { EmailService } from '../email.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

describe('AuthService — Password Reset', () => {
  let service: AuthService;
  let mockAuthRepo: jest.Mocked<AuthRepository>;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockPrisma: Record<string, any>;

  const mockTransaction = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    mockAuthRepo = {
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      createPasswordResetToken: jest.fn(),
      findValidPasswordResetTokens: jest.fn(),
      markPasswordResetTokenUsed: jest.fn(),
      updateUserPasswordHash: jest.fn(),
      revokeRefreshTokens: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    mockEmailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmailService>;

    mockPrisma = { $transaction: mockTransaction };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: RolesRepository, useValue: {} },
        { provide: JwtService, useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('forgotPassword', () => {
    it('returns generic success for existing email', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isActive: true,
        deletedAt: null,
      } as any);

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('If an account with that email exists');
      expect(mockAuthRepo.createPasswordResetToken).toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('returns same generic success for non-existing email', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(result.message).toContain('If an account with that email exists');
      expect(mockAuthRepo.createPasswordResetToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('returns same success for inactive/deleted user', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        isActive: false,
        deletedAt: new Date(),
      } as any);

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('If an account with that email exists');
      expect(mockAuthRepo.createPasswordResetToken).not.toHaveBeenCalled();
    });

    it('creates token with expiry', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
      } as any);

      await service.forgotPassword('test@example.com');

      const callArgs = mockAuthRepo.createPasswordResetToken.mock.calls[0]!;
      expect(callArgs[0]).toBe('user-1'); // userId
      expect(callArgs[1]).toBe('hashed-password'); // tokenHash (bcrypt)
      expect(callArgs[2]).toBeInstanceOf(Date); // expiresAt
      // expiresAt should be ~1 hour from now
      const expiryMs = callArgs[2].getTime() - Date.now();
      expect(expiryMs).toBeGreaterThan(55 * 60 * 1000); // at least 55 min
      expect(expiryMs).toBeLessThan(65 * 60 * 1000); // at most 65 min
    });

    it('does NOT log the raw token', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
      } as any);

      await service.forgotPassword('test@example.com');

      const emailCallArgs = mockEmailService.sendPasswordResetEmail.mock.calls[0]!;
      expect(emailCallArgs[0]).toBe('test@example.com');
      expect(typeof emailCallArgs[1]).toBe('string');
      expect(emailCallArgs[1].length).toBe(64); // 32 bytes hex
    });
  });

  describe('resetPassword', () => {
    it('succeeds with valid token via bcrypt.compare', async () => {
      // findValidPasswordResetTokens returns candidates; bcrypt.compare finds match
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false); // first candidate — no match
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);  // second candidate — match

      mockAuthRepo.findValidPasswordResetTokens.mockResolvedValue([
        { id: 'token-old', userId: 'user-1', tokenHash: 'old-hash', expiresAt: new Date(Date.now() + 3600000) },
        { id: 'token-1', userId: 'user-1', tokenHash: 'stored-hash', expiresAt: new Date(Date.now() + 3600000) },
      ]);

      mockTransaction.mockImplementation(async (fn: Function) => fn({}));

      const result = await service.resetPassword('raw-token', 'NewPass123');

      expect(result.message).toContain('Password reset successful');
      expect(mockAuthRepo.updateUserPasswordHash).toHaveBeenCalledWith(
        'user-1',
        'hashed-password',
        expect.anything(),
      );
      expect(mockAuthRepo.markPasswordResetTokenUsed).toHaveBeenCalledWith(
        'token-1',
        expect.anything(),
      );
      expect(mockAuthRepo.revokeRefreshTokens).toHaveBeenCalledWith(
        'user-1',
        expect.anything(),
      );
    });

    it('rejects when no token matches bcrypt.compare', async () => {
      // All candidates fail comparison
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      mockAuthRepo.findValidPasswordResetTokens.mockResolvedValue([
        { id: 'token-1', userId: 'user-1', tokenHash: 'hash', expiresAt: new Date(Date.now() + 3600000) },
      ]);

      await expect(
        service.resetPassword('wrong-token', 'NewPass123'),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('rejects when no valid tokens exist', async () => {
      mockAuthRepo.findValidPasswordResetTokens.mockResolvedValue([]);

      await expect(
        service.resetPassword('any-token', 'NewPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired tokens (not returned by repository)', async () => {
      // Repository only returns non-expired tokens, so bcrypt.compare never runs
      mockAuthRepo.findValidPasswordResetTokens.mockResolvedValue([]);

      await expect(
        service.resetPassword('expired-token', 'NewPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects already-used tokens (not returned by repository)', async () => {
      // Repository filters usedAt: null, so used tokens are excluded
      mockAuthRepo.findValidPasswordResetTokens.mockResolvedValue([]);

      await expect(
        service.resetPassword('used-token', 'NewPass123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks token as used in same transaction as password update', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      mockAuthRepo.findValidPasswordResetTokens.mockResolvedValue([
        { id: 'token-1', userId: 'user-1', tokenHash: 'hash', expiresAt: new Date(Date.now() + 3600000) },
      ]);

      const transactionFn = jest.fn(async (fn: Function) => fn({}));
      mockTransaction.mockImplementation(transactionFn);

      await service.resetPassword('raw-token', 'NewPass123');

      expect(mockAuthRepo.updateUserPasswordHash).toHaveBeenCalled();
      expect(mockAuthRepo.markPasswordResetTokenUsed).toHaveBeenCalled();
      expect(mockAuthRepo.revokeRefreshTokens).toHaveBeenCalled();
      expect(transactionFn).toHaveBeenCalledTimes(1);
    });

    it('hashes new password with bcrypt', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      // resetPassword only calls bcrypt.hash once — for the new password hash
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('new-password-hash');

      mockAuthRepo.findValidPasswordResetTokens.mockResolvedValue([
        { id: 'token-1', userId: 'user-1', tokenHash: 'hash', expiresAt: new Date(Date.now() + 3600000) },
      ]);

      mockTransaction.mockImplementation(async (fn: Function) => fn({}));

      await service.resetPassword('raw-token', 'NewPass123');

      expect(mockAuthRepo.updateUserPasswordHash).toHaveBeenCalledWith(
        'user-1',
        'new-password-hash',
        expect.anything(),
      );
    });
  });
});
