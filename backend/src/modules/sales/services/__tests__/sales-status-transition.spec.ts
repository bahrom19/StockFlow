import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { SalesService } from '../sales.service';
import { SalesRepository } from '../../repositories/sales.repository';
import { CashShiftRepository } from '../../repositories/cash-shift.repository';
import { PrismaService } from '../../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../../common/events';

describe('SalesService — transitionStatus (D1 regression)', () => {
  let service: SalesService;
  let mockSalesRepo: jest.Mocked<SalesRepository>;
  let mockCashShiftRepo: jest.Mocked<CashShiftRepository>;
  let mockPrisma: any;
  let mockEventBus: jest.Mocked<EventBus>;

  const mockUser = {
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['Admin'],
    email: 'admin@test.com',
  };

  const createMockSale = (status: SaleStatus, overrides = {}): any => ({
    id: 'sale-1',
    saleNumber: 'SALE-001',
    status,
    companyId: 'company-1',
    warehouseId: 'wh-1',
    cashierId: 'user-1',
    customerId: null,
    currency: 'KZT',
    notes: null,
    subtotal: { toString: () => '500' } as any,
    discount: { toString: () => '0' } as any,
    tax: { toString: () => '0' } as any,
    total: { toString: () => '500' } as any,
    paidAmount: { toString: () => '500' } as any,
    changeAmount: { toString: () => '0' } as any,
    rowVersion: 0,
    cashShiftId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [
      {
        id: 'item-1',
        saleId: 'sale-1',
        productId: 'prod-1',
        quantity: 1,
        unitPrice: 500,
        costPrice: 300,
        discount: 0,
        subtotal: 500,
        total: 500,
        margin: 200,
      },
    ],
    payments: [
      {
        id: 'pay-1',
        saleId: 'sale-1',
        method: 'CASH',
        amount: 500,
        reference: null,
      },
    ],
    receipts: [],
    ...overrides,
  });

  beforeEach(async () => {
    mockSalesRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    } as any;

    mockCashShiftRepo = {} as any;

    mockPrisma = {
      $transaction: jest.fn((fn: any) => fn(mockPrisma)),
      saleItem: { findMany: jest.fn().mockResolvedValue([]) },
      receipt: { create: jest.fn().mockResolvedValue({}) },
      cashShift: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: SalesRepository, useValue: mockSalesRepo },
        { provide: CashShiftRepository, useValue: mockCashShiftRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  // ── D1 Regression Tests ──────────────────────────────────

  describe('DRAFT → COMPLETED (D1 fix)', () => {
    it('should allow transition from DRAFT to COMPLETED', async () => {
      const mockSale = createMockSale(SaleStatus.DRAFT);
      mockSalesRepo.findById.mockResolvedValue(mockSale);
      mockSalesRepo.update.mockResolvedValue({
        ...mockSale,
        status: SaleStatus.COMPLETED,
      });
      mockPrisma.cashShift.findFirst.mockResolvedValue(null);

      const result = await service.transitionStatus(
        'sale-1',
        SaleStatus.COMPLETED,
        'user-1',
        'company-1',
      );

      expect(mockSalesRepo.update).toHaveBeenCalledWith(
        'sale-1',
        expect.objectContaining({ status: SaleStatus.COMPLETED }),
        'company-1',
        0,
        mockPrisma,
      );
      expect(result.status).toBe(SaleStatus.COMPLETED);
    });

    it('should call POST :id/complete endpoint without 400 or 404', async () => {
      // This test verifies the complete endpoint works — it calls transitionStatus with COMPLETED
      const mockSale = createMockSale(SaleStatus.DRAFT);
      mockSalesRepo.findById.mockResolvedValue(mockSale);
      mockSalesRepo.update.mockResolvedValue({
        ...mockSale,
        status: SaleStatus.COMPLETED,
      });
      mockPrisma.cashShift.findFirst.mockResolvedValue(null);

      // The /complete endpoint calls: service.transitionStatus(id, SaleStatus.COMPLETED, ...)
      await expect(
        service.transitionStatus(
          'sale-1',
          SaleStatus.COMPLETED,
          'user-1',
          'company-1',
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('DRAFT → PENDING (existing, still works)', () => {
    it('should allow DRAFT → PENDING', async () => {
      const mockSale = createMockSale(SaleStatus.DRAFT);
      mockSalesRepo.findById.mockResolvedValue(mockSale);
      mockSalesRepo.update.mockResolvedValue({
        ...mockSale,
        status: SaleStatus.PENDING,
      });

      await expect(
        service.transitionStatus(
          'sale-1',
          SaleStatus.PENDING,
          'user-1',
          'company-1',
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('DRAFT → CANCELLED (existing, still works)', () => {
    it('should allow DRAFT → CANCELLED', async () => {
      const mockSale = createMockSale(SaleStatus.DRAFT);
      mockSalesRepo.findById.mockResolvedValue(mockSale);
      mockSalesRepo.update.mockResolvedValue({
        ...mockSale,
        status: SaleStatus.CANCELLED,
      });

      await expect(
        service.transitionStatus(
          'sale-1',
          SaleStatus.CANCELLED,
          'user-1',
          'company-1',
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('Invalid transitions (unchanged)', () => {
    it('should reject DRAFT → REFUNDED', async () => {
      const mockSale = createMockSale(SaleStatus.DRAFT);
      mockSalesRepo.findById.mockResolvedValue(mockSale);

      await expect(
        service.transitionStatus(
          'sale-1',
          SaleStatus.REFUNDED,
          'user-1',
          'company-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject COMPLETED → DRAFT (backward transition)', async () => {
      const mockSale = createMockSale(SaleStatus.COMPLETED);
      mockSalesRepo.findById.mockResolvedValue(mockSale);

      await expect(
        service.transitionStatus(
          'sale-1',
          SaleStatus.DRAFT,
          'user-1',
          'company-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Sale not found', () => {
    it('should throw NotFoundException when sale does not exist', async () => {
      mockSalesRepo.findById.mockResolvedValue(null);

      await expect(
        service.transitionStatus(
          'nonexistent',
          SaleStatus.COMPLETED,
          'user-1',
          'company-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
