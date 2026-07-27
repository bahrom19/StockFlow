import { Test, TestingModule } from '@nestjs/testing';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { TaskService } from '../services/task.service';
import { TaskRepository } from '../repositories/task.repository';
import { TaskMapper } from '../mappers/task.mapper';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';

describe('TaskService', () => {
  let service: TaskService;
  let mockRepo: jest.Mocked<TaskRepository>;
  let mockMapper: jest.Mocked<TaskMapper>;
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
    } as unknown as jest.Mocked<TaskRepository>;

    mockMapper = {
      toEntity: jest.fn(),
      toEntityList: jest.fn(),
    } as unknown as jest.Mocked<TaskMapper>;

    mockTx = {};
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockTx)),
    };
    mockAuditLog = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: TaskRepository, useValue: mockRepo },
        { provide: TaskMapper, useValue: mockMapper },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: EVENT_BUS, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should create a task with default status TODO and priority MEDIUM', async () => {
    mockRepo.create.mockResolvedValue({ id: 'task-1', status: 'TODO' } as any);
    mockMapper.toEntity.mockReturnValue({ id: 'task-1' } as any);

    await service.create({ title: 'Test Task' } as any, companyId, userId);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
      }),
      expect.anything(),
    );
  });

  it('should create a task with audit log', async () => {
    mockRepo.create.mockResolvedValue({ id: 'task-1' } as any);
    mockMapper.toEntity.mockReturnValue({ id: 'task-1' } as any);

    const result = await service.create(
      { title: 'Test' } as any,
      companyId,
      userId,
    );
    expect(result.id).toBe('task-1');
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE' }),
    );
  });

  it('should find all tasks with pagination and filters', async () => {
    mockRepo.findMany.mockResolvedValue([[], 0] as any);
    mockMapper.toEntityList.mockReturnValue([]);

    await service.findAll(
      { page: 1, limit: 20, status: 'IN_PROGRESS' } as any,
      companyId,
    );
    expect(mockRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        where: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );
  });

  it('should update task status and set completedAt when DONE', async () => {
    mockRepo.findByIdOrThrow.mockResolvedValue({
      id: 'task-1',
      completedAt: null,
    } as any);
    mockRepo.update.mockResolvedValue({
      id: 'task-1',
      status: 'DONE',
      completedAt: new Date(),
    } as any);
    mockMapper.toEntity.mockReturnValue({
      id: 'task-1',
      status: 'DONE',
    } as any);

    const result = await service.update(
      'task-1',
      { status: 'DONE' } as any,
      companyId,
      userId,
    );
    expect(mockRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DONE',
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('should soft delete task with audit log', async () => {
    mockRepo.findByIdOrThrow.mockResolvedValue({ id: 'task-1' } as any);
    await service.remove('task-1', companyId, userId);
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE' }),
    );
  });
});
