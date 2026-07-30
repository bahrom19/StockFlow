import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrderController } from '../controllers/purchase-order.controller';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { PurchaseOrderEntity } from '../entities/purchase-order.entity';

describe('PurchaseOrderController — transitionStatus (B5 regression)', () => {
  let controller: PurchaseOrderController;
  let mockService: jest.Mocked<PurchaseOrderService>;

  const mockUser = {
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['Admin'],
    email: 'admin@test.com',
  };

  const mockOrder: PurchaseOrderEntity = {
    id: 'po-1',
    orderNumber: 'PO-001',
    status: 'PENDING' as PurchaseOrderStatus,
    companyId: 'company-1',
    supplierId: 'supplier-1',
    orderDate: new Date(),
    expectedDate: null,
    subtotal: '10000',
    discountAmount: '0',
    taxAmount: '0',
    grandTotal: '10000',
    paidAmount: '0',
    notes: null,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [],
  };

  beforeEach(() => {
    mockService = {
      transitionStatus: jest.fn().mockResolvedValue(mockOrder),
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getNextOrderNumber: jest.fn(),
    } as unknown as jest.Mocked<PurchaseOrderService>;

    controller = new PurchaseOrderController(mockService);
  });

  describe('transitionStatus — @Body("status") reads status from JSON body', () => {
    it('should read status from body and delegate to service', async () => {
      const result = await controller.transitionStatus(
        'po-1',
        'PENDING' as PurchaseOrderStatus,
        mockUser,
      );

      expect(mockService.transitionStatus).toHaveBeenCalledWith(
        'po-1',
        'PENDING',
        mockUser.userId,
        mockUser.companyId,
      );
      expect(result.status).toBe('PENDING');
    });

    it('should propagate service errors', async () => {
      mockService.transitionStatus.mockRejectedValue(
        new Error('Cannot transition from ORDERED to DRAFT'),
      );

      await expect(
        controller.transitionStatus(
          'po-1',
          'DRAFT' as PurchaseOrderStatus,
          mockUser,
        ),
      ).rejects.toThrow('Cannot transition from ORDERED to DRAFT');
    });

    it('should handle APPROVED status', async () => {
      mockService.transitionStatus.mockResolvedValue({
        ...mockOrder,
        status: 'APPROVED' as PurchaseOrderStatus,
      });

      const result = await controller.transitionStatus(
        'po-1',
        'APPROVED' as PurchaseOrderStatus,
        mockUser,
      );

      expect(mockService.transitionStatus).toHaveBeenCalledWith(
        'po-1',
        'APPROVED',
        mockUser.userId,
        mockUser.companyId,
      );
      expect(result.status).toBe('APPROVED');
    });

    it('should handle ORDERED status', async () => {
      mockService.transitionStatus.mockResolvedValue({
        ...mockOrder,
        status: 'ORDERED' as PurchaseOrderStatus,
      });

      const result = await controller.transitionStatus(
        'po-1',
        'ORDERED' as PurchaseOrderStatus,
        mockUser,
      );

      expect(mockService.transitionStatus).toHaveBeenCalledWith(
        'po-1',
        'ORDERED',
        mockUser.userId,
        mockUser.companyId,
      );
      expect(result.status).toBe('ORDERED');
    });
  });
});
