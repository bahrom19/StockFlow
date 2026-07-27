import { Test, TestingModule } from '@nestjs/testing';
import { OpportunityStatus, OpportunityPriority } from '@prisma/client';
import { OpportunityService } from '../services/opportunity.service';
import { OpportunityRepository } from '../repositories/opportunity.repository';
import { OpportunityMapper } from '../mappers/opportunity.mapper';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';

describe('OpportunityService', () => {
  let service: OpportunityService;
  let mockRepo: jest.Mocked<OpportunityRepository>;
  let mockMapper: jest.Mocked<OpportunityMapper>;
  let mockPrisma: { $transaction: jest.Mock };
  let mockAuditLog: jest.Mocked<AuditLogService>;
  let mockTx: Record<string, any>;

  const companyId = 'comp-1';
  const userId = 'user-1';

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      findMany: jest.fn(),
      findByIdOrThrow: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<OpportunityRepository>;

    mockMapper = {
      toEntity: jest.fn(),
      toEntityList: jest.fn(),
    } as unknown as jest.Mocked<OpportunityMapper>;

    mockTx = {};
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockTx)),
    };
    mockAuditLog = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityService,
        { provide: OpportunityRepository, useValue: mockRepo },
        { provide: OpportunityMapper, useValue: mockMapper },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: EVENT_BUS, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<OpportunityService>(OpportunityService);
  });

  it('should create opportunity with default status NEW and priority MEDIUM', async () => {
    mockRepo.create.mockResolvedValue({ id: 'opp-1' } as any);
    mockMapper.toEntity.mockReturnValue({ id: 'opp-1' } as any);

    await service.create(
      { title: 'Big Deal', customerId: 'cust-1' } as any,
      companyId,
      userId,
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.MEDIUM,
      }),
      expect.anything(),
    );
  });

  it('should find all opportunities with pagination', async () => {
    mockRepo.findMany.mockResolvedValue([[], 0] as any);
    mockMapper.toEntityList.mockReturnValue([]);
    await service.findAll({ page: 1, limit: 20 } as any, companyId);
    expect(mockRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ companyId }),
    );
  });

  it('should update opportunity with audit log', async () => {
    mockRepo.findByIdOrThrow.mockResolvedValue({ id: 'opp-1' } as any);
    mockRepo.update.mockResolvedValue({ id: 'opp-1', value: 50000 } as any);
    mockMapper.toEntity.mockReturnValue({ id: 'opp-1', value: 50000 } as any);

    const result = await service.update(
      'opp-1',
      { value: 50000 } as any,
      companyId,
      userId,
    );
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE' }),
    );
  });

  it('should soft delete opportunity with audit log', async () => {
    mockRepo.findByIdOrThrow.mockResolvedValue({ id: 'opp-1' } as any);
    await service.remove('opp-1', companyId, userId);
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE' }),
    );
  });
});
