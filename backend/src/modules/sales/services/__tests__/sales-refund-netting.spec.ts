import { Test, TestingModule } from '@nestjs/testing';
import { SaleStatus } from '@prisma/client';
import { SalesService } from '../sales.service';
import { SalesRepository } from '../../repositories/sales.repository';
import { CashShiftRepository } from '../../repositories/cash-shift.repository';
import { PrismaService } from '../../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../../common/events';

/**
 * Regression tests for refund netting into the active cash shift (v1.1.1
 * Medium fix).
 *
 * Invariant: after a refund, Cash Shift == Sales (the shift totals are
 * reduced by exactly the amounts allocated at completion).
 */
describe('SalesService — refund cash shift netting (v1.1.1)', () => {
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

  const createMockSale = (overrides: Record<string, any> = {}): any => ({
    id: 'sale-1',
    saleNumber: 'SALE-001',
    status: SaleStatus.COMPLETED,
    companyId: 'company-1',
    warehouseId: 'wh-1',
    cashierId: 'user-1',
    customerId: null,
    currency: 'KZT',
    notes: null,
    subtotal: { toString: () => '1800' } as any,
    discount: { toString: () => '0' } as any,
    tax: { toString: () => '0' } as any,
    total: { toString: () => '1800' } as any,
    paidAmount: { toString: () => '1800' } as any,
    changeAmount: { toString: () => '0' } as any,
    rowVersion: 0,
    cashShiftId: 'shift-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [],
    payments: [],
    receipts: [],
    ...overrides,
  });

  const createOpenShift = (overrides: Record<string, any> = {}): any => ({
    id: 'shift-1',
    companyId: 'company-1',
    warehouseId: 'wh-1',
    cashierId: 'user-1',
    status: 'OPEN',
    openingBalance: { toString: () => '0' } as any,
    cashSales: { toString: () => '4800' } as any,
    cardSales: { toString: () => '0' } as any,
    qrSales: { toString: () => '0' } as any,
    bankTransferSales: { toString: () => '0' } as any,
    mobileWalletSales: { toString: () => '0' } as any,
    totalSales: { toString: () => '4800' } as any,
    cashIn: { toString: () => '0' } as any,
    cashOut: { toString: () => '0' } as any,
    expectedClosing: { toString: () => '4800' } as any,
    rowVersion: 2,
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

    mockCashShiftRepo = {
      update: jest
        .fn()
        .mockImplementation((_id, data, _c, _rv, _tx) =>
          Promise.resolve({ id: 'shift-1', ...data }),
        ),
    } as any;

    mockPrisma = {
      $transaction: jest.fn((fn: any) => fn(mockPrisma)),
      saleItem: { findMany: jest.fn().mockResolvedValue([]) },
      receipt: { create: jest.fn().mockResolvedValue({}) },
      cashShift: {
        findFirst: jest.fn().mockResolvedValue(createOpenShift()),
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

  const transitionToRefunded = (mockSale: any) =>
    service.transitionStatus(
      'sale-1',
      SaleStatus.REFUNDED,
      mockUser.userId,
      mockUser.companyId,
    );

  it('nets cash sales (tendered − change) and totalSales from the shift', async () => {
    const mockSale = createMockSale({
      total: { toString: () => '1500' } as any,
      paidAmount: { toString: () => '1800' } as any,
      changeAmount: { toString: () => '300' } as any,
      payments: [{ method: 'CASH', amount: 1800 }],
    });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockSalesRepo.update.mockResolvedValue({
      ...mockSale,
      status: SaleStatus.REFUNDED,
    });
    mockPrisma.cashShift.findFirst.mockResolvedValue(
      createOpenShift({ cashSales: '5000', totalSales: '5000' }),
    );
    mockPrisma.payment.findMany.mockResolvedValue([
      { method: 'CASH', amount: 1800 },
    ]);

    await transitionToRefunded(mockSale);

    expect(mockCashShiftRepo.update).toHaveBeenCalledTimes(1);
    const [shiftId, data] = (mockCashShiftRepo.update as jest.Mock).mock
      .calls[0];
    expect(shiftId).toBe('shift-1');
    expect(data.cashSales.toString()).toBe('3500');
    expect(data.cardSales.toString()).toBe('0');
    expect(data.totalSales.toString()).toBe('3500');
    // optimistic locking: rowVersion passed through
    const rowVersionArg = (mockCashShiftRepo.update as jest.Mock).mock
      .calls[0][3];
    expect(rowVersionArg).toBe(2);
  });

  it('nets mixed payment allocation per-method (v1.2: QR → qrSales)', async () => {
    const mockSale = createMockSale({
      total: { toString: () => '900' } as any,
      paidAmount: { toString: () => '900' } as any,
      changeAmount: { toString: () => '0' } as any,
      payments: [
        { method: 'CASH', amount: 300 },
        { method: 'CARD', amount: 400 },
        { method: 'QR', amount: 200 },
      ],
    });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockSalesRepo.update.mockResolvedValue({
      ...mockSale,
      status: SaleStatus.REFUNDED,
    });
    // Shift reflects the completed state: card 400 + qr 200 were added.
    mockPrisma.cashShift.findFirst.mockResolvedValue(
      createOpenShift({
        cashSales: '1000',
        cardSales: '2000',
        qrSales: '200',
        totalSales: '3000',
      }),
    );
    mockPrisma.payment.findMany.mockResolvedValue([
      { method: 'CASH', amount: 300 },
      { method: 'CARD', amount: 400 },
      { method: 'QR', amount: 200 },
    ]);

    await transitionToRefunded(mockSale);

    const data = (mockCashShiftRepo.update as jest.Mock).mock.calls[0][1];
    expect(data.cashSales.toString()).toBe('700'); // 1000 − 300
    expect(data.cardSales.toString()).toBe('1600'); // 2000 − 400 (card only)
    expect(data.qrSales.toString()).toBe('0'); // 200 − 200 (qr bucket)
    expect(data.totalSales.toString()).toBe('2100'); // 3000 − 900
  });

  it('nets bank transfer and mobile wallet into their own buckets (v1.2)', async () => {
    const mockSale = createMockSale({
      total: { toString: () => '800' } as any,
      paidAmount: { toString: () => '800' } as any,
      changeAmount: { toString: () => '0' } as any,
      payments: [
        { method: 'BANK_TRANSFER', amount: 500 },
        { method: 'MOBILE_WALLET', amount: 300 },
      ],
    });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockSalesRepo.update.mockResolvedValue({
      ...mockSale,
      status: SaleStatus.REFUNDED,
    });
    mockPrisma.cashShift.findFirst.mockResolvedValue(
      createOpenShift({
        bankTransferSales: '500',
        mobileWalletSales: '300',
        totalSales: '800',
      }),
    );
    mockPrisma.payment.findMany.mockResolvedValue([
      { method: 'BANK_TRANSFER', amount: 500 },
      { method: 'MOBILE_WALLET', amount: 300 },
    ]);

    await transitionToRefunded(mockSale);

    const data = (mockCashShiftRepo.update as jest.Mock).mock.calls[0][1];
    expect(data.bankTransferSales.toString()).toBe('0'); // 500 − 500
    expect(data.mobileWalletSales.toString()).toBe('0'); // 300 − 300
    expect(data.totalSales.toString()).toBe('0'); // 800 − 800
  });

  it('rejects unknown payment methods during refund netting (v1.2)', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    const mockSale = createMockSale({
      payments: [{ method: 'GIFT_CARD', amount: 900 }],
    });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockSalesRepo.update.mockResolvedValue({
      ...mockSale,
      status: SaleStatus.REFUNDED,
    });
    mockPrisma.cashShift.findFirst.mockResolvedValue(createOpenShift());
    mockPrisma.payment.findMany.mockResolvedValue([
      { method: 'GIFT_CARD', amount: 900 },
    ]);

    await expect(transitionToRefunded(mockSale)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockCashShiftRepo.update).not.toHaveBeenCalled();
  });

  it('does not decrement when the sale has no linked shift', async () => {
    const mockSale = createMockSale({ cashShiftId: null });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockSalesRepo.update.mockResolvedValue({
      ...mockSale,
      status: SaleStatus.REFUNDED,
    });

    await transitionToRefunded(mockSale);

    expect(mockPrisma.cashShift.findFirst).not.toHaveBeenCalled();
    expect(mockCashShiftRepo.update).not.toHaveBeenCalled();
  });

  it('does not decrement a CLOSED shift (Z report is final)', async () => {
    const mockSale = createMockSale();
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockSalesRepo.update.mockResolvedValue({
      ...mockSale,
      status: SaleStatus.REFUNDED,
    });
    mockPrisma.cashShift.findFirst.mockResolvedValue(
      createOpenShift({ status: 'CLOSED' }),
    );

    await transitionToRefunded(mockSale);

    expect(mockCashShiftRepo.update).not.toHaveBeenCalled();
  });

  it('propagates rowVersion conflict (409) instead of double-decrementing', async () => {
    const { ConflictException } = await import('@nestjs/common');
    const mockSale = createMockSale();
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockSalesRepo.update.mockResolvedValue({
      ...mockSale,
      status: SaleStatus.REFUNDED,
    });
    mockCashShiftRepo.update = jest
      .fn()
      .mockRejectedValue(
        new ConflictException('Cash shift was modified by another user'),
      );

    await expect(transitionToRefunded(mockSale)).rejects.toThrow(
      ConflictException,
    );
  });
});
