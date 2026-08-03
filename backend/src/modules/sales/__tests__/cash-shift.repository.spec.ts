import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

const companyId = 'comp-1';
const shiftId = 'shift-1';

const baseShift = {
  id: shiftId,
  companyId,
  warehouseId: 'wh-1',
  cashierId: 'user-1',
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

describe('CashShiftRepository — optimistic locking (H2)', () => {
  let repository: CashShiftRepository;
  let mockPrisma: Record<string, any>;

  beforeEach(async () => {
    mockPrisma = {
      cashShift: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((arg: any) =>
          Array.isArray(arg)
            ? Promise.all(arg)
            : arg instanceof Function
              ? arg(mockPrisma)
              : arg,
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashShiftRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<CashShiftRepository>(CashShiftRepository);
  });

  it('should update shift when rowVersion matches (scalar split)', async () => {
    mockPrisma.cashShift.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.cashShift.findUnique.mockResolvedValue({
      ...baseShift,
      rowVersion: 1,
      status: 'CLOSED',
    });

    const result = await repository.update(
      shiftId,
      { status: 'CLOSED', closedAt: new Date() },
      companyId,
      0,
    );

    expect(mockPrisma.cashShift.updateMany).toHaveBeenCalledWith({
      where: { id: shiftId, companyId, rowVersion: 0 },
      data: {
        status: 'CLOSED',
        closedAt: expect.any(Date),
        rowVersion: { increment: 1 },
      },
    });
    expect(result.rowVersion).toBe(1);
    expect(result.status).toBe('CLOSED');
  });

  it('should throw ConflictException when rowVersion is stale', async () => {
    mockPrisma.cashShift.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.cashShift.findFirst.mockResolvedValue({
      ...baseShift,
      rowVersion: 1,
    });

    await expect(
      repository.update(shiftId, { status: 'CLOSED' }, companyId, 0),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when shift is missing', async () => {
    mockPrisma.cashShift.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.cashShift.findFirst.mockResolvedValue(null);

    await expect(
      repository.update(shiftId, { status: 'CLOSED' }, companyId, 0),
    ).rejects.toThrow(NotFoundException);
  });

  it('should apply relation writes via update after the lock check (B1 pattern)', async () => {
    mockPrisma.cashShift.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.cashShift.update = jest.fn().mockResolvedValue(baseShift);
    mockPrisma.cashShift.findUnique.mockResolvedValue(baseShift);

    await repository.update(
      shiftId,
      { cashier: { connect: { id: 'user-2' } } } as any,
      companyId,
      0,
    );

    expect(mockPrisma.cashShift.updateMany).toHaveBeenCalledWith({
      where: { id: shiftId, companyId, rowVersion: 0 },
      data: { rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.cashShift.update).toHaveBeenCalledWith({
      where: { id: shiftId },
      data: { cashier: { connect: { id: 'user-2' } } },
    });
  });

  it('legacy path without rowVersion still works', async () => {
    mockPrisma.cashShift.findFirst.mockResolvedValue(baseShift);
    mockPrisma.cashShift.update = jest
      .fn()
      .mockResolvedValue({ ...baseShift, cashIn: new Prisma.Decimal('50') });

    const result = await repository.update(
      shiftId,
      { cashIn: new Prisma.Decimal('50') },
      companyId,
    );
    expect(mockPrisma.cashShift.update).toHaveBeenCalled();
    expect(result.cashIn.toString()).toBe('50');
  });
});
