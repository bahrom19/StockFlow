import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SalesRefundService } from '../../../sales-refund/services/sales-refund.service';
import { SalesRefundRepository } from '../../../sales-refund/repositories/sales-refund.repository';
import { SalesRepository } from '../../repositories/sales.repository';
import { CashShiftRepository } from '../../repositories/cash-shift.repository';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { DocumentSequenceService } from '../../../shared/services/document-sequence.service';
import { PrismaService } from '../../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../../common/events';
import { CustomerCreditLedgerService } from '../../../crm/services/customer-credit-ledger.service';
import { CustomerCreditLedgerRepository } from '../../../crm/repositories/customer-credit-ledger.repository';

/**
 * Regression tests for refund netting into the active cash shift (v1.1.1
 * Medium fix) — MIGRATED to the G11-E E2 refund owner.
 *
 * G11-E E2 moved refund-lifecycle ownership away from
 * `SalesService.transitionStatus(..., REFUNDED, ...)` to `SalesRefundService`
 * (`refundAllRemaining` = "refund ALL remaining quantities"). The legacy
 * full-refund cash-shift behaviour is preserved verbatim inside
 * `SalesRefundService.applyLegacyFullRefundSideEffects`, so every business
 * scenario and assertion below is unchanged — only the invocation target moved.
 *
 * Invariant: after a refund, Cash Shift == Sales (the shift totals are
 * reduced by exactly the amounts allocated at completion).
 */
describe('SalesRefundService — refund cash shift netting (v1.1.1, E2 owner)', () => {
  let service: SalesRefundService;
  let mockSalesRepo: jest.Mocked<SalesRepository>;
  let mockCashShiftRepo: any;
  let mockSalesRefundRepo: any;
  let mockDocumentSequence: any;
  let mockAuditLog: any;
  let mockPrisma: any;
  let mockEventBus: jest.Mocked<EventBus>;
  let mockTx: any;

  const mockUser = {
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['Admin'],
    email: 'admin@test.com',
  };

  const createSaleItem = (overrides: Record<string, any> = {}): any => ({
    id: 'item-1',
    saleId: 'sale-1',
    productId: 'prod-1',
    quantity: 1,
    unitPrice: new Decimal('1500'),
    costPrice: new Decimal('1000'),
    fifoCost: new Decimal('1000'),
    discount: new Decimal('0'),
    subtotal: new Decimal('1500'),
    total: new Decimal('1500'),
    margin: new Decimal('500'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

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
    subtotal: new Decimal('1800'),
    discount: new Decimal('0'),
    tax: new Decimal('0'),
    total: new Decimal('1800'),
    paidAmount: new Decimal('1800'),
    changeAmount: new Decimal('0'),
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
    openingBalance: new Decimal('0'),
    cashSales: new Decimal('4800'),
    cardSales: new Decimal('0'),
    qrSales: new Decimal('0'),
    bankTransferSales: new Decimal('0'),
    mobileWalletSales: new Decimal('0'),
    totalSales: new Decimal('4800'),
    cashIn: new Decimal('0'),
    cashOut: new Decimal('0'),
    expectedClosing: new Decimal('4800'),
    rowVersion: 2,
    ...overrides,
  });
  beforeEach(async () => {
    mockSalesRepo = {
      findById: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(createMockSale()),
    } as any;

    mockCashShiftRepo = {
      update: jest
        .fn()
        .mockImplementation((_id: string, data: any, _c: string, _rv: number) =>
          Promise.resolve({ id: 'shift-1', ...data }),
        ),
    };

    mockSalesRefundRepo = {
      create: jest.fn().mockResolvedValue({
        id: 'refund-1',
        companyId: 'company-1',
        saleId: 'sale-1',
        warehouseId: 'wh-1',
        refundNumber: 'REF-COMPANY1-0001',
        status: 'COMPLETED',
        total: new Decimal('0'),
        currency: 'KZT',
        reason: null,
        reference: null,
        createdBy: 'user-1',
        rowVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        items: [],
      }),
      findById: jest.fn(),
      findBySaleId: jest.fn(),
      aggregateCompletedBySaleItem: jest.fn().mockResolvedValue(new Map()),
    };

    mockDocumentSequence = { nextNumber: jest.fn().mockResolvedValue(1) };

    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };

    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) } as any;

    mockTx = {
      saleItem: { findMany: jest.fn().mockResolvedValue([createSaleItem()]) },
      cashShift: { findFirst: jest.fn().mockResolvedValue(createOpenShift()) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
    };

    mockPrisma = { $transaction: jest.fn((fn: any) => fn(mockTx)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesRefundService,
        { provide: SalesRepository, useValue: mockSalesRepo },
        { provide: CashShiftRepository, useValue: mockCashShiftRepo },
        { provide: SalesRefundRepository, useValue: mockSalesRefundRepo },
        { provide: DocumentSequenceService, useValue: mockDocumentSequence },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: mockEventBus },
        CustomerCreditLedgerService,
        { provide: CustomerCreditLedgerRepository, useValue: { findCustomerCompany: jest.fn().mockResolvedValue({ id: 'cust-1' }), getBalances: jest.fn().mockResolvedValue(new Map()), issueRefundCredit: jest.fn().mockResolvedValue({}), createManualAdjustment: jest.fn(), atomicSpend: jest.fn() } },
      ],
    }).compile();

    service = module.get<SalesRefundService>(SalesRefundService);
  });

  /**
   * G11-E E2 full-refund path: refunds ALL remaining quantities of a
   * COMPLETED sale in ONE operation (never a partial refund).
   */
  const refundAll = () =>
    service.refundAllRemaining('sale-1', mockUser.userId, mockUser.companyId);
  it('nets cash sales (tendered − change) and totalSales from the shift', async () => {
    const mockSale = createMockSale({
      total: new Decimal('1500'),
      paidAmount: new Decimal('1800'),
      changeAmount: new Decimal('300'),
    });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockTx.cashShift.findFirst.mockResolvedValue(
      createOpenShift({
        cashSales: new Decimal('5000'),
        totalSales: new Decimal('5000'),
      }),
    );
    mockTx.payment.findMany.mockResolvedValue([
      { method: 'CASH', amount: new Decimal('1800') },
    ]);

    await refundAll();

    expect(mockCashShiftRepo.update).toHaveBeenCalledTimes(1);
    const call = mockCashShiftRepo.update.mock.calls[0];
    const data = call?.[1] as any;
    expect(call?.[0]).toBe('shift-1');
    expect(data.cashSales.toString()).toBe('3500');
    expect(data.cardSales.toString()).toBe('0');
    expect(data.totalSales.toString()).toBe('3500');
    // optimistic locking: rowVersion passed through
    expect(call?.[3]).toBe(2);
  });

  it('nets mixed payment allocation per-method (v1.2: QR → qrSales)', async () => {
    const mockSale = createMockSale({
      total: new Decimal('900'),
      paidAmount: new Decimal('900'),
      changeAmount: new Decimal('0'),
    });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    // Shift reflects the completed state: card 400 + qr 200 were added.
    mockTx.cashShift.findFirst.mockResolvedValue(
      createOpenShift({
        cashSales: new Decimal('1000'),
        cardSales: new Decimal('2000'),
        qrSales: new Decimal('200'),
        totalSales: new Decimal('3000'),
      }),
    );
    mockTx.payment.findMany.mockResolvedValue([
      { method: 'CASH', amount: new Decimal('300') },
      { method: 'CARD', amount: new Decimal('400') },
      { method: 'QR', amount: new Decimal('200') },
    ]);

    await refundAll();

    const data = mockCashShiftRepo.update.mock.calls[0]?.[1] as any;
    expect(data.cashSales.toString()).toBe('700'); // 1000 − 300
    expect(data.cardSales.toString()).toBe('1600'); // 2000 − 400 (card only)
    expect(data.qrSales.toString()).toBe('0'); // 200 − 200 (qr bucket)
    expect(data.totalSales.toString()).toBe('2100'); // 3000 − 900
  });

  it('nets bank transfer and mobile wallet into their own buckets (v1.2)', async () => {
    const mockSale = createMockSale({
      total: new Decimal('800'),
      paidAmount: new Decimal('800'),
      changeAmount: new Decimal('0'),
    });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockTx.cashShift.findFirst.mockResolvedValue(
      createOpenShift({
        bankTransferSales: new Decimal('500'),
        mobileWalletSales: new Decimal('300'),
        totalSales: new Decimal('800'),
      }),
    );
    mockTx.payment.findMany.mockResolvedValue([
      { method: 'BANK_TRANSFER', amount: new Decimal('500') },
      { method: 'MOBILE_WALLET', amount: new Decimal('300') },
    ]);

    await refundAll();

    const data = mockCashShiftRepo.update.mock.calls[0]?.[1] as any;
    expect(data.bankTransferSales.toString()).toBe('0'); // 500 − 500
    expect(data.mobileWalletSales.toString()).toBe('0'); // 300 − 300
    expect(data.totalSales.toString()).toBe('0'); // 800 − 800
  });

  it('rejects unknown payment methods during refund netting (v1.2)', async () => {
    const mockSale = createMockSale({
      total: new Decimal('900'),
      paidAmount: new Decimal('900'),
      changeAmount: new Decimal('0'),
    });
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockTx.cashShift.findFirst.mockResolvedValue(createOpenShift());
    mockTx.payment.findMany.mockResolvedValue([
      { method: 'GIFT_CARD', amount: new Decimal('900') },
    ]);

    let caught: unknown;
    try {
      await refundAll();
    } catch (error) {
      caught = error;
    }

    // The rejection MUST originate from the payment-allocation / netting
    // validation — NOT from a refund-status guard. Assert the exact allocation
    // message (the status guard emits a different message).
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as Error).message).toContain('Unsupported payment method');
    // Proof the refund service actually reached the legacy cash-shift/payment
    // allocation logic before rejecting:
    expect(mockTx.payment.findMany).toHaveBeenCalled();
    expect(mockTx.cashShift.findFirst).toHaveBeenCalled();
    // ...and that no shift write happened.
    expect(mockCashShiftRepo.update).not.toHaveBeenCalled();
  });

  it('does not decrement when the sale has no linked shift', async () => {
    const mockSale = createMockSale({ cashShiftId: null });
    mockSalesRepo.findById.mockResolvedValue(mockSale);

    await refundAll();

    expect(mockTx.cashShift.findFirst).not.toHaveBeenCalled();
    expect(mockCashShiftRepo.update).not.toHaveBeenCalled();
  });

  it('does not decrement a CLOSED shift (Z report is final)', async () => {
    const mockSale = createMockSale();
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockTx.cashShift.findFirst.mockResolvedValue(
      createOpenShift({ status: 'CLOSED' }),
    );

    await refundAll();

    expect(mockCashShiftRepo.update).not.toHaveBeenCalled();
  });

  it('propagates rowVersion conflict (409) instead of double-decrementing', async () => {
    const mockSale = createMockSale();
    mockSalesRepo.findById.mockResolvedValue(mockSale);
    mockCashShiftRepo.update = jest
      .fn()
      .mockRejectedValue(
        new ConflictException('Cash shift was modified by another user'),
      );

    await expect(refundAll()).rejects.toThrow(ConflictException);
  });
});