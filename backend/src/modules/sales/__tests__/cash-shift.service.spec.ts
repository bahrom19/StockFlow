import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CashShiftService } from '../services/cash-shift.service';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

const companyId = 'comp-1';
const userId = 'user-1';
const warehouseId = 'wh-1';

const baseShift = {
  id: 'shift-1',
  companyId,
  warehouseId,
  cashierId: userId,
  status: 'OPEN' as const,
  openedAt: new Date(),
  closedAt: null,
  openingBalance: new Prisma.Decimal('100.0000'),
  closingBalance: new Prisma.Decimal('100.0000'),
  cashSales: new Prisma.Decimal('0'),
  cardSales: new Prisma.Decimal('0'),
  totalSales: new Prisma.Decimal('0'),
  cashIn: new Prisma.Decimal('0'),
  cashOut: new Prisma.Decimal('0'),
  expectedClosing: new Prisma.Decimal('100.0000'),
  difference: new Prisma.Decimal('0'),
  notes: null,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CashShiftService — H1 atomic open / H2 optimistic locking', () => {
  let service: CashShiftService;
  let repo: jest.Mocked<CashShiftRepository>;
  let mockPrisma: Record<string, any>;
  let txCallback: ((tx: any) => Promise<any>) | null;

  beforeEach(async () => {
    txCallback = null;
    repo = {
      findOpenShift: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      listByCompany: jest.fn(),
    } as any;

    mockPrisma = {
      $transaction: jest.fn((cb: any) => {
        txCallback = cb;
        return cb(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashShiftService,
        { provide: CashShiftRepository, useValue: repo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CashShiftService>(CashShiftService);
  });

  afterEach(() => jest.clearAllMocks());

  // ───────────────────────────────
  // H1 — openShift atomicity
  // ───────────────────────────────
  it('openShift: creates shift when none open', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    repo.create.mockResolvedValue(baseShift);

    const result = await service.openShift(
      { warehouseId, openingBalance: 100 },
      userId,
      companyId,
    );

    expect(result.id).toBe('shift-1');
    expect(repo.findOpenShift).toHaveBeenCalledWith(
      warehouseId,
      userId,
      companyId,
      expect.anything(), // tx
    );
    expect(repo.create).toHaveBeenCalled();
  });

  it('openShift: throws ConflictException (409) when an OPEN shift already exists', async () => {
    repo.findOpenShift.mockResolvedValue(baseShift);

    await expect(
      service.openShift({ warehouseId, openingBalance: 100 }, userId, companyId),
    ).rejects.toThrow(ConflictException);
  });

  it('openShift: maps DB P2002 (concurrent insert) to ConflictException (409)', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '5',
    });
    repo.create.mockRejectedValue(p2002);

    await expect(
      service.openShift({ warehouseId, openingBalance: 100 }, userId, companyId),
    ).rejects.toThrow(ConflictException);
  });

  it('openShift: propagates non-P2002 errors unchanged', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    repo.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.openShift({ warehouseId, openingBalance: 100 }, userId, companyId),
    ).rejects.toThrow('db down');
  });

  // ───────────────────────────────
  // H2 — closeShift optimistic locking
  // ───────────────────────────────
  it('closeShift: passes rowVersion to repository update', async () => {
    repo.findOpenShift.mockResolvedValue({ ...baseShift, rowVersion: 3 });
    repo.update.mockResolvedValue({ ...baseShift, status: 'CLOSED' as const });

    await service.closeShift(
      { actualClosingBalance: 150 },
      userId,
      companyId,
      warehouseId,
    );

    expect(repo.update).toHaveBeenCalledWith(
      'shift-1',
      expect.objectContaining({ status: 'CLOSED' }),
      companyId,
      3, // rowVersion from the read
      expect.anything(), // tx
    );
  });

  it('closeShift: throws NotFoundException when no open shift', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    await expect(
      service.closeShift({}, userId, companyId, warehouseId),
    ).rejects.toThrow(NotFoundException);
  });

  // ───────────────────────────────
  // H2 — cashIn / cashOut optimistic locking
  // ───────────────────────────────
  it('cashIn: read-modify-write passes rowVersion (lost update impossible)', async () => {
    repo.findOpenShift.mockResolvedValue({
      ...baseShift,
      cashIn: new Prisma.Decimal('10'),
      rowVersion: 5,
    });
    repo.update.mockResolvedValue({
      ...baseShift,
      cashIn: new Prisma.Decimal('15'),
    });

    await service.cashIn({ amount: 5 }, userId, companyId, warehouseId);

    expect(repo.update).toHaveBeenCalledWith(
      'shift-1',
      expect.objectContaining({ cashIn: expect.any(Prisma.Decimal) }),
      companyId,
      5,
      expect.anything(),
    );
    const updateData = (repo.update.mock.calls[0]![1] as any).cashIn as Prisma.Decimal;
    expect(updateData.toString()).toBe('15');
  });

  it('cashOut: computes cashOut + amount with rowVersion guard', async () => {
    repo.findOpenShift.mockResolvedValue({
      ...baseShift,
      cashOut: new Prisma.Decimal('3'),
      rowVersion: 2,
    });
    repo.update.mockResolvedValue({
      ...baseShift,
      cashOut: new Prisma.Decimal('8'),
    });

    await service.cashOut({ amount: 5 }, userId, companyId, warehouseId);

    expect(repo.update).toHaveBeenCalledWith(
      'shift-1',
      expect.objectContaining({ cashOut: expect.any(Prisma.Decimal) }),
      companyId,
      2,
      expect.anything(),
    );
  });

  it('cashIn: rethrows ConflictException from repository (concurrent mutation)', async () => {
    repo.findOpenShift.mockResolvedValue({ ...baseShift, rowVersion: 1 });
    repo.update.mockRejectedValue(
      new ConflictException('Cash shift shift-1 was modified by another user'),
    );

    await expect(
      service.cashIn({ amount: 5 }, userId, companyId, warehouseId),
    ).rejects.toThrow(ConflictException);
  });

  it('cashIn: rejects negative amounts', async () => {
    repo.findOpenShift.mockResolvedValue(baseShift);
    await expect(
      service.cashIn({ amount: -5 }, userId, companyId, warehouseId),
    ).rejects.toThrow('Amount must not be negative');
  });
});
