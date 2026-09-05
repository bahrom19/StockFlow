import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SalesService } from '../services/sales.service';
import { SalesRepository } from '../repositories/sales.repository';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EVENT_BUS } from '../../../common/events';

const companyId = 'comp-1';
const userId = 'user-1';
const warehouseId = 'wh-1';
const saleId = 'sale-1';
const shiftId = 'shift-1';

const makeSale = (currency = 'KZT') =>
  ({
    id: saleId,
    companyId,
    warehouseId,
    cashierId: userId,
    saleNumber: 'S-001',
    status: SaleStatus.PENDING,
    subtotal: new Prisma.Decimal('100'),
    discountAmount: new Prisma.Decimal('0'),
    discount: new Prisma.Decimal('0'),
    taxAmount: new Prisma.Decimal('0'),
    grandTotal: new Prisma.Decimal('100'),
    total: new Prisma.Decimal('100'),
    paidAmount: new Prisma.Decimal('100'),
    changeAmount: new Prisma.Decimal('0'),
    currency,
    notes: null,
    customerId: null,
    loyaltyPointsUsed: null,
    loyaltyPointsEarned: null,
    cashShiftId: null,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  }) as any;

const makeShift = (currency = 'KZT') =>
  ({
    id: shiftId,
    companyId,
    warehouseId,
    cashierId: userId,
    status: 'OPEN' as const,
    currency,
    openedAt: new Date(),
    closedAt: null,
    openingBalance: new Prisma.Decimal('100'),
    closingBalance: new Prisma.Decimal('100'),
    cashSales: new Prisma.Decimal('0'),
    cardSales: new Prisma.Decimal('0'),
    qrSales: new Prisma.Decimal('0'),
    bankTransferSales: new Prisma.Decimal('0'),
    mobileWalletSales: new Prisma.Decimal('0'),
    totalSales: new Prisma.Decimal('0'),
    cashIn: new Prisma.Decimal('0'),
    cashOut: new Prisma.Decimal('0'),
    expectedClosing: new Prisma.Decimal('100'),
    difference: new Prisma.Decimal('0'),
    notes: null,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as any;

describe('SalesService — Sale ↔ CashShift currency invariant', () => {
  let service: SalesService;
  let mockSalesRepo: jest.Mocked<SalesRepository>;
  let mockCashShiftRepo: jest.Mocked<CashShiftRepository>;
  let mockPrisma: Record<string, any>;
  let mockEventBus: { publish: jest.Mock };

  beforeEach(async () => {
    mockSalesRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      findBySaleNumber: jest.fn(),
      getNextSaleNumber: jest.fn(),
      softDelete: jest.fn(),
    } as any;
    mockCashShiftRepo = {
      findOpenShift: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      listByCompany: jest.fn(),
    } as any;
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    // Mock Prisma — $transaction passes tx context through callback
    // completeSale accesses tx.cashShift.findFirst directly
    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => {
        const tx = {
          saleItem: { findMany: jest.fn().mockResolvedValue([]) },
          receipt: { create: jest.fn() },
          payment: { findMany: jest.fn().mockResolvedValue([]) },
          cashShift: { findFirst: jest.fn() },
        };
        return cb(tx);
      }),
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: SalesRepository, useValue: mockSalesRepo },
        { provide: CashShiftRepository, useValue: mockCashShiftRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = mod.get(SalesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('completeSale currency check', () => {
    // Helper: creates a Prisma-like tx mock with a cashShift.findFirst returning the given shift
    const txWithShift = (shiftObj: any) => ({
      saleItem: { findMany: jest.fn().mockResolvedValue([]) },
      receipt: { create: jest.fn() },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      cashShift: { findFirst: jest.fn().mockResolvedValue(shiftObj) },
      auditLog: { create: jest.fn() },
    });

    it('should allow sale when currencies match (KZT + KZT)', async () => {
      const sale = makeSale('KZT');
      const shift = makeShift('KZT');
      mockSalesRepo.findById.mockResolvedValue(sale);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb(txWithShift(shift));
      });
      mockSalesRepo.update.mockResolvedValue({ ...sale, status: SaleStatus.COMPLETED } as any);

      const result = await service.transitionStatus(
        saleId,
        SaleStatus.COMPLETED,
        userId,
        companyId,
      );

      expect(result).toBeDefined();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should allow sale when currencies match (USD + USD)', async () => {
      const sale = makeSale('USD');
      const shift = makeShift('USD');
      mockSalesRepo.findById.mockResolvedValue(sale);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb(txWithShift(shift));
      });
      mockSalesRepo.update.mockResolvedValue({ ...sale, status: SaleStatus.COMPLETED } as any);

      const result = await service.transitionStatus(
        saleId,
        SaleStatus.COMPLETED,
        userId,
        companyId,
      );

      expect(result).toBeDefined();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should reject sale when USD sale enters KZT shift', async () => {
      const sale = makeSale('USD');
      const shift = makeShift('KZT');
      mockSalesRepo.findById.mockResolvedValue(sale);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb(txWithShift(shift));
      });

      await expect(
        service.transitionStatus(saleId, SaleStatus.COMPLETED, userId, companyId),
      ).rejects.toThrow(BadRequestException);

      // No events — side effects blocked before publishing
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should reject sale when KZT sale enters USD shift', async () => {
      const sale = makeSale('KZT');
      const shift = makeShift('USD');
      mockSalesRepo.findById.mockResolvedValue(sale);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb(txWithShift(shift));
      });

      await expect(
        service.transitionStatus(saleId, SaleStatus.COMPLETED, userId, companyId),
      ).rejects.toThrow(BadRequestException);

      // No events — side effects blocked before publishing
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
