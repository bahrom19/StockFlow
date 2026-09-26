import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { SalesService } from '../services/sales.service';
import { SalesRepository } from '../repositories/sales.repository';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { PrismaService } from '../../../common/prisma';
import { CompaniesService } from '../../companies/services/companies.service';
import { CustomerCreditLedgerService } from '../../crm/services/customer-credit-ledger.service';

/**
 * G16-B-03 (F-1) — Sale create must reject inactive products.
 *
 * An inactive product belongs to the caller's company and is not deleted, so
 * only the `isActive: true` predicate in the per-item lookup separates a valid
 * sale from a sale that moves stock (and later StockMovements via the
 * sale.completed handler) for a deactivated product. Foreign/missing/deleted
 * products were already rejected; this locks in the state dimension with the
 * same indistinguishable 404 and proves no sale/event side effects occur.
 */
describe('SalesService.create — inactive product rejection (G16-B-03 F-1)', () => {
  const companyId = 'comp-1';
  const userId = 'user-1';
  const warehouseId = 'wh-1';
  const productId = 'prod-1';

  const saleDto = (productIdOverride: string) => ({
    warehouseId,
    items: [{ productId: productIdOverride, quantity: 2, unitPrice: 10 }],
    payments: [{ method: 'CASH', amount: 20 }],
  });

  const activeProduct = { id: productId, companyId, costPrice: null };

  let mockTx: Record<string, any>;
  let salesRepository: { create: jest.Mock; getNextSaleNumber: jest.Mock };
  let cashShiftRepository: Record<string, never>;
  let eventBus: { publish: jest.Mock };
  let companiesService: { getBaseCurrency: jest.Mock };
  let creditLedger: Record<string, never>;
  let service: SalesService;

  beforeEach(() => {
    mockTx = {
      warehouse: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: warehouseId, companyId, isActive: true }),
      },
      product: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: any) =>
            Promise.resolve(
              where?.isActive === true
                ? activeProduct
                : null,
            ),
          ),
      },
      saleItem: { findMany: jest.fn().mockResolvedValue([]) },
    };
    salesRepository = {
      create: jest.fn().mockResolvedValue({
        id: 'sale-1',
        companyId,
        saleNumber: 'S-0001',
        status: SaleStatus.DRAFT,
      }),
      getNextSaleNumber: jest.fn().mockResolvedValue({ saleNumber: 'S-0001' }),
    };
    cashShiftRepository = {};
    eventBus = { publish: jest.fn() };
    companiesService = {
      getBaseCurrency: jest.fn().mockResolvedValue('KZT'),
    };
    creditLedger = {};

    const prisma = {
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    service = new SalesService(
      salesRepository as unknown as SalesRepository,
      cashShiftRepository as unknown as CashShiftRepository,
      prisma as unknown as PrismaService,
      eventBus as any,
      companiesService as unknown as CompaniesService,
      creditLedger as unknown as CustomerCreditLedgerService,
    );
  });

  it('creates a sale for a same-company active product (regression)', async () => {
    const result = await service.create(saleDto(productId), userId, companyId);

    expect(mockTx.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: productId,
          companyId,
          deletedAt: null,
          isActive: true,
        }),
      }),
    );
    expect(salesRepository.create).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('rejects an inactive product with the indistinguishable 404', async () => {
    mockTx.product.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.create(saleDto('inactive-product'), userId, companyId),
    ).rejects.toThrow(NotFoundException);

    expect(mockTx.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
    expect(salesRepository.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('performs no sale/items/event side effects when validation fails', async () => {
    mockTx.product.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.create(saleDto('inactive-product'), userId, companyId),
    ).rejects.toThrow(/not found/);

    expect(salesRepository.create).not.toHaveBeenCalled();
    expect(mockTx.saleItem.findMany).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('still rejects a foreign product with the same error shape', async () => {
    mockTx.product.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.create(saleDto('foreign-product'), userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(salesRepository.create).not.toHaveBeenCalled();
  });

  it('insufficient payment still fails closed before any write (boundary)', async () => {
    // Payment guard is independent of product state and must keep working.
    await expect(
      service.create(
        {
          warehouseId,
          items: [{ productId, quantity: 2, unitPrice: 10 }],
          payments: [{ method: 'CASH', amount: 5 }],
        },
        userId,
        companyId,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(salesRepository.create).not.toHaveBeenCalled();
  });
});
