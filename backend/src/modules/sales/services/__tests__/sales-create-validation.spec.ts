import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { SalesService } from '../sales.service';
import { SalesRepository } from '../../repositories/sales.repository';
import { CashShiftRepository } from '../../repositories/cash-shift.repository';
import { PrismaService } from '../../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../../common/events';

describe('SalesService — create payment validation (change/overpayment Phase 1)', () => {
  let service: SalesService;
  let mockSalesRepo: jest.Mocked<SalesRepository>;
  let mockPrisma: any;

  const companyId = 'comp-1';
  const userId = 'user-1';
  const warehouseId = 'wh-1';
  const productId = 'prod-1';

  beforeEach(async () => {
    mockSalesRepo = {
      getNextSaleNumber: jest.fn().mockResolvedValue('SALE-0001'),
      create: jest.fn().mockResolvedValue({
        id: 'sale-1',
        saleNumber: 'SALE-0001',
        status: SaleStatus.DRAFT,
        changeAmount: new Prisma.Decimal('0'),
        paidAmount: new Prisma.Decimal('0'),
        total: new Prisma.Decimal('0'),
      }),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      updateStatus: jest.fn(),
      findAll: jest.fn(),
      getReceiptBySaleId: jest.fn(),
      findBySaleNumber: jest.fn(),
    } as unknown as jest.Mocked<SalesRepository>;

    const mockTx = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
      },
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      product: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: productId,
            costPrice: new Prisma.Decimal('900'),
          }),
      },
    };

    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: SalesRepository, useValue: mockSalesRepo },
        { provide: CashShiftRepository, useValue: {} },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  const baseDto = () => ({
    warehouseId,
    items: [
      {
        productId,
        quantity: 1,
        unitPrice: 1500,
        costPrice: 900,
      },
    ],
    payments: [{ method: 'CASH', amount: 1500 }],
  });

  it('should create a sale with exact payment', async () => {
    const result = await service.create(baseDto(), userId, companyId);
    expect(mockSalesRepo.create).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(SaleStatus.DRAFT);
  });

  it('should create a sale with overpayment (paid 1800, total 1500)', async () => {
    const dto = baseDto();
    dto.payments = [{ method: 'CASH', amount: 1800 }];
    mockSalesRepo.create.mockResolvedValueOnce({
      id: 'sale-1',
      saleNumber: 'SALE-0001',
      status: SaleStatus.DRAFT,
      changeAmount: new Prisma.Decimal('300'),
      paidAmount: new Prisma.Decimal('1800'),
      total: new Prisma.Decimal('1500'),
    } as any);

    const result = await service.create(dto, userId, companyId);

    // The change amount must be computed and persisted
    const createArg = mockSalesRepo.create.mock.calls[0]![0] as any;
    expect(createArg.changeAmount.toString()).toBe('300');
    expect(createArg.paidAmount.toString()).toBe('1800');
    expect(createArg.total.toString()).toBe('1500');
    expect(result.status).toBe(SaleStatus.DRAFT);
  });

  it('should reject insufficient payment with 400 BadRequest (no sale created)', async () => {
    const dto = baseDto();
    dto.payments = [{ method: 'CASH', amount: 1200 }];

    await expect(service.create(dto, userId, companyId)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.create(dto, userId, companyId),
    ).rejects.toThrow(/Insufficient payment/);
    expect(mockSalesRepo.create).not.toHaveBeenCalled();
  });

  it('should reject zero payment with 400 BadRequest', async () => {
    const dto = baseDto();
    dto.payments = [{ method: 'CASH', amount: 0 }];

    await expect(service.create(dto, userId, companyId)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSalesRepo.create).not.toHaveBeenCalled();
  });
});
