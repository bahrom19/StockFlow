import { DocumentSequenceService } from '../document-sequence.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';

/**
 * M2 regression — atomic per-company document numbering.
 *
 * Replaces the racy `count + 1` / `Date.now()` generators: the service consumes
 * a value via a single Prisma `upsert` (INSERT ... ON CONFLICT DO UPDATE), so
 * two parallel calls always receive distinct numbers.
 */
describe('DocumentSequenceService — atomic nextNumber (M2)', () => {
  let service: DocumentSequenceService;
  let mockPrisma: {
    documentSequence: { upsert: jest.Mock };
  };

  const companyId = 'comp-1';

  beforeEach(() => {
    mockPrisma = {
      documentSequence: { upsert: jest.fn() },
    };
    service = new DocumentSequenceService(
      mockPrisma as unknown as PrismaService,
    );
  });

  it('should initialize the counter to 1 on first use (create branch)', async () => {
    mockPrisma.documentSequence.upsert.mockResolvedValue({
      companyId,
      type: 'SALE',
      lastNumber: 1,
    });

    const result = await service.nextNumber(companyId, 'SALE');

    expect(mockPrisma.documentSequence.upsert).toHaveBeenCalledWith({
      where: { companyId_type: { companyId, type: 'SALE' } },
      create: { companyId, type: 'SALE', lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    expect(result).toBe(1);
  });

  it('should return the incremented counter on subsequent calls (update branch)', async () => {
    mockPrisma.documentSequence.upsert.mockResolvedValue({
      companyId,
      type: 'PURCHASE_ORDER',
      lastNumber: 12,
    });

    const result = await service.nextNumber(companyId, 'PURCHASE_ORDER');

    expect(mockPrisma.documentSequence.upsert).toHaveBeenCalledWith({
      where: { companyId_type: { companyId, type: 'PURCHASE_ORDER' } },
      create: { companyId, type: 'PURCHASE_ORDER', lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    expect(result).toBe(12);
  });

  it('should keep per-company counters independent', async () => {
    mockPrisma.documentSequence.upsert.mockResolvedValue({
      companyId: 'comp-2',
      type: 'SALE',
      lastNumber: 3,
    });

    await service.nextNumber('comp-2', 'SALE');

    expect(mockPrisma.documentSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_type: { companyId: 'comp-2', type: 'SALE' },
        },
      }),
    );
  });
});
