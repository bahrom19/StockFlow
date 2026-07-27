import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../services/audit-log.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockPrisma: Record<string, any>;

  const entry = {
    companyId: 'comp-1',
    userId: 'user-1',
    entityType: 'Sale',
    entityId: 'sale-1',
    action: 'COMPLETED',
    before: null,
    after: { status: 'COMPLETED', total: '100.00' },
  };

  beforeEach(async () => {
    mockPrisma = {
      auditLog: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should create audit log entry', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

    await service.log(entry);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        companyId: 'comp-1',
        userId: 'user-1',
        entity: 'Sale',
        entityId: 'sale-1',
        action: 'COMPLETED',
        oldValues: undefined,
        newValues: { status: 'COMPLETED', total: '100.00' },
      },
    });
  });

  it('should use provided transaction client when available', async () => {
    const mockTx = {
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    };

    await service.log(entry, mockTx as any);

    expect(mockTx.auditLog.create).toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled(); // Should NOT use default prisma
  });

  it('should serialize before/after values via JSON parse/stringify', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

    await service.log({
      ...entry,
      before: { nested: { value: 42 } },
      after: { arr: [1, 2, 3] },
    });

    const callData = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(callData.oldValues).toEqual({ nested: { value: 42 } });
    expect(callData.newValues).toEqual({ arr: [1, 2, 3] });
  });

  it('should set before/after to undefined when null', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

    await service.log(entry);

    const callData = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(callData.oldValues).toBeUndefined();
    expect(callData.newValues).toEqual({
      status: 'COMPLETED',
      total: '100.00',
    });
  });
});
