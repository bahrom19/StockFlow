import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JournalEntriesRepository } from '../repositories/journal-entries.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';

/**
 * Regression tests for the Blocker B1 pattern in JournalEntriesRepository.update:
 * relation writes (e.g. `postedByUser: { connect }` from
 * JournalEntriesService) must NOT be passed into `journalEntry.updateMany`,
 * which only accepts scalar fields (JournalEntryUpdateManyMutationInput).
 */
describe('JournalEntriesRepository — update with relation writes + optimistic locking (B1 regression)', () => {
  let repo: JournalEntriesRepository;
  let mockPrisma: Record<string, any>;
  let mockSeq: { nextNumber: jest.Mock };

  const baseEntry = {
    id: 'je-1',
    companyId: 'comp-1',
    financialPeriodId: 'fp-1',
    entryNumber: 1,
    entryDate: new Date(),
    description: null,
    status: 'DRAFT',
    totalDebit: new Prisma.Decimal('100'),
    totalCredit: new Prisma.Decimal('100'),
    referenceType: null,
    referenceId: null,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [],
  };

  beforeEach(async () => {
    mockPrisma = {
      journalEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    mockSeq = { nextNumber: jest.fn().mockResolvedValue(1) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalEntriesRepository,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DocumentSequenceService, useValue: mockSeq },
      ],
    }).compile();

    repo = module.get<JournalEntriesRepository>(JournalEntriesRepository);
  });

  it('should NOT pass relation writes (postedByUser connect) to updateMany — B1 fix', async () => {
    mockPrisma.journalEntry.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.journalEntry.findFirst.mockResolvedValue(baseEntry as any);

    const data: Prisma.JournalEntryUpdateInput = {
      status: 'POSTED',
      postedAt: new Date(),
      postedByUser: { connect: { id: 'user-1' } },
    };

    const result = await repo.update('je-1', data, 'comp-1', 0);

    expect(mockPrisma.journalEntry.updateMany).toHaveBeenCalledWith({
      where: { id: 'je-1', companyId: 'comp-1', rowVersion: 0 },
      data: { status: 'POSTED', postedAt: expect.any(Date), rowVersion: { increment: 1 } },
    });
    // postedByUser connect goes through a follow-up update
    expect(mockPrisma.journalEntry.update).toHaveBeenCalledWith({
      where: { id: 'je-1' },
      data: { postedByUser: { connect: { id: 'user-1' } } },
    });
    expect(result.id).toBe('je-1');
  });

  it('should apply scalar-only updates via updateMany without a follow-up update', async () => {
    mockPrisma.journalEntry.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.journalEntry.findFirst.mockResolvedValue(baseEntry as any);

    await repo.update('je-1', { status: 'POSTED' }, 'comp-1', 0);

    expect(mockPrisma.journalEntry.updateMany).toHaveBeenCalledWith({
      where: { id: 'je-1', companyId: 'comp-1', rowVersion: 0 },
      data: { status: 'POSTED', rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.journalEntry.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when rowVersion is stale', async () => {
    mockPrisma.journalEntry.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.journalEntry.findFirst.mockResolvedValue({
      ...baseEntry,
      rowVersion: 5,
    });

    await expect(
      repo.update('je-1', { status: 'POSTED' }, 'comp-1', 0),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when journal entry does not exist', async () => {
    mockPrisma.journalEntry.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

    await expect(
      repo.update('je-1', { status: 'POSTED' }, 'comp-1', 0),
    ).rejects.toThrow(NotFoundException);
  });
});
