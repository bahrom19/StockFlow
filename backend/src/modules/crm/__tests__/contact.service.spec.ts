import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ContactService } from '../services/contact.service';
import { ContactRepository } from '../repositories/contact.repository';
import { ContactMapper } from '../mappers/contact.mapper';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';

describe('ContactService', () => {
  let service: ContactService;
  let mockRepo: jest.Mocked<ContactRepository>;
  let mockMapper: jest.Mocked<ContactMapper>;
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
    } as unknown as jest.Mocked<ContactRepository>;

    mockMapper = {
      toEntity: jest.fn(),
      toEntityList: jest.fn(),
    } as unknown as jest.Mocked<ContactMapper>;

    mockTx = {};
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockTx)),
    };

    mockAuditLog = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: ContactRepository, useValue: mockRepo },
        { provide: ContactMapper, useValue: mockMapper },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: EVENT_BUS, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  it('should create a contact with audit log', async () => {
    const created = { id: 'contact-1', firstName: 'John' };
    mockRepo.create.mockResolvedValue(created as any);
    mockMapper.toEntity.mockReturnValue({ id: 'contact-1' } as any);

    const result = await service.create(
      { customerId: 'cust-1', firstName: 'John', lastName: 'Doe' } as any,
      companyId,
      userId,
    );

    expect(result.id).toBe('contact-1');
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE' }),
    );
  });

  it('should find all contacts with pagination', async () => {
    mockRepo.findMany.mockResolvedValue([[], 0] as any);
    mockMapper.toEntityList.mockReturnValue([]);
    await service.findAll({ page: 1, limit: 20 } as any, companyId);
    expect(mockRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ companyId }),
    );
  });

  it('should find one contact', async () => {
    mockRepo.findByIdOrThrow.mockResolvedValue({ id: 'contact-1' } as any);
    mockMapper.toEntity.mockReturnValue({ id: 'contact-1' } as any);
    const result = await service.findOne('contact-1', companyId);
    expect(result.id).toBe('contact-1');
  });

  it('should update contact with audit log', async () => {
    const before = { id: 'contact-1', firstName: 'Old' };
    const after = { id: 'contact-1', firstName: 'New' };
    mockRepo.findByIdOrThrow.mockResolvedValue(before as any);
    mockRepo.update.mockResolvedValue(after as any);
    mockMapper.toEntity.mockReturnValue(after as any);

    const result = await service.update(
      'contact-1',
      { firstName: 'New' } as any,
      companyId,
      userId,
    );
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE' }),
    );
  });

  it('should soft delete contact with audit log', async () => {
    mockRepo.findByIdOrThrow.mockResolvedValue({ id: 'contact-1' } as any);
    await service.remove('contact-1', companyId, userId);
    expect(mockRepo.softDelete).toHaveBeenCalledWith(
      'contact-1',
      companyId,
      expect.anything(),
    );
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE' }),
    );
  });
});
