import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from '../services/invoice.service';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import { PrismaService } from '../../../common/prisma';
import { EVENT_BUS } from '../../../common/events';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let mockInvoiceRepo: jest.Mocked<InvoiceRepository>;
  let mockSubRepo: jest.Mocked<CompanySubscriptionRepository>;
  let mockPaymentRepo: jest.Mocked<PaymentTransactionRepository>;
  let mockEventBus: { publish: jest.Mock };
  let mockTx: any;

  const mockInvoice = {
    id: 'inv-1',
    companyId: 'comp-1',
    subscriptionId: 'sub-1',
    invoiceNumber: 'INV-20260801-A3F2C9',
    status: 'PENDING',
    subtotal: 29.99,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 29.99,
    paidAmount: 0,
    currency: 'USD',
    dueDate: new Date(Date.now() + 30 * 86400000),
    paidAt: null,
    providerInvoiceId: null,
    notes: null,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockSubscription = {
    id: 'sub-1',
    companyId: 'comp-1',
    planId: 'plan-1',
    status: 'ACTIVE',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    rowVersion: 0,
    plan: { priceMonthly: 29.99, currency: 'USD', name: 'Starter' },
  } as any;

  beforeEach(async () => {
    mockTx = {
      auditLog: { create: jest.fn() },
    };

    mockInvoiceRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySubscription: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getNextInvoiceNumber: jest.fn(),
    } as any;

    mockSubRepo = {
      findById: jest.fn(),
      findByCompany: jest.fn(),
    } as any;

    mockPaymentRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByInvoice: jest.fn(),
      update: jest.fn(),
    } as any;

    mockEventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: InvoiceRepository, useValue: mockInvoiceRepo },
        { provide: CompanySubscriptionRepository, useValue: mockSubRepo },
        { provide: PaymentTransactionRepository, useValue: mockPaymentRepo },
        { provide: PrismaService, useValue: { $transaction: jest.fn((cb: any) => cb(mockTx)) } },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  describe('findAll', () => {
    it('should return paginated invoices', async () => {
      mockInvoiceRepo.findAll.mockResolvedValue({ items: [mockInvoice as any], total: 1 });
      const result = await service.findAll({}, 'comp-1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should reject negative page', async () => {
      await expect(service.findAll({ page: -1 }, 'comp-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return invoice', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice as any);
      const result = await service.findById('inv-1', 'comp-1');
      expect(result.id).toBe('inv-1');
    });

    it('should throw if not found', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(null);
      await expect(service.findById('missing', 'comp-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateInvoice', () => {
    it('should generate an invoice for a subscription', async () => {
      mockSubRepo.findById.mockResolvedValue(mockSubscription as any);
      mockInvoiceRepo.getNextInvoiceNumber.mockResolvedValue('INV-20260801-A3F2C9');
      mockInvoiceRepo.create.mockResolvedValue({ ...mockInvoice, lines: [] } as any);

      const result = await service.generateInvoice('sub-1', 'comp-1', 'user-1');
      expect(result.invoiceNumber).toBe('INV-20260801-A3F2C9');
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalled();
    });

    it('should throw if subscription not found', async () => {
      mockSubRepo.findById.mockResolvedValue(null);
      await expect(service.generateInvoice('missing', 'comp-1', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('markPaid', () => {
    it('should mark invoice as paid and create payment transaction', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice as any);
      mockInvoiceRepo.update.mockResolvedValue({ ...mockInvoice, status: 'PAID' } as any);
      mockPaymentRepo.create.mockResolvedValue({ id: 'pmt-1' } as any);

      const result = await service.markPaid('inv-1', 'comp-1', '29.99');
      expect(result.status).toBe('PAID');
      expect(mockPaymentRepo.create).toHaveBeenCalled(); // PaymentTransaction created
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalled(); // Audit log created
    });

    it('should throw for non-pending invoice', async () => {
      mockInvoiceRepo.findById.mockResolvedValue({ ...mockInvoice, status: 'PAID' } as any);
      await expect(service.markPaid('inv-1', 'comp-1', '29.99'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('voidInvoice', () => {
    it('should void a pending invoice', async () => {
      mockInvoiceRepo.findById.mockResolvedValue(mockInvoice as any);
      mockInvoiceRepo.update.mockResolvedValue({ ...mockInvoice, status: 'CANCELLED' } as any);

      const result = await service.voidInvoice('inv-1', 'comp-1');
      expect(result.status).toBe('CANCELLED');
      expect(mockTx.auditLog.create).toHaveBeenCalled(); // Audit log created
    });

    it('should throw for non-pending invoice', async () => {
      mockInvoiceRepo.findById.mockResolvedValue({ ...mockInvoice, status: 'PAID' } as any);
      await expect(service.voidInvoice('inv-1', 'comp-1')).rejects.toThrow(BadRequestException);
    });
  });
});
