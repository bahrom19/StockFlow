import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuotationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { CreateSupplierQuotationDto } from '../dto/create-supplier-quotation.dto';
import { SupplierQuotationQueryDto } from '../dto/supplier-quotation-query.dto';
import { SupplierQuotationEntity } from '../entities/supplier-quotation.entity';
import { SupplierQuotationMapper } from '../mappers/supplier-quotation.mapper';
import { SupplierQuotationRepository } from '../repositories/supplier-quotation.repository';
import { RFQRepository } from '../repositories/rfq.repository';
import { AuditLogService } from '../../shared/services/audit-log.service';

function toDecimal(
  value: string | number | Decimal | null | undefined,
): Decimal {
  if (value == null) return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

@Injectable()
export class SupplierQuotationService {
  constructor(
    private readonly repository: SupplierQuotationRepository,
    private readonly rfqRepository: RFQRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateSupplierQuotationDto,
    userId: string,
    companyId: string,
  ): Promise<SupplierQuotationEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const quotationNumber =
        dto.quotationNumber ??
        `QTN-${companyId.substring(0, 8).toUpperCase()}-${Date.now()}`;
      const existing = await this.repository.findByQuotationNumber(
        quotationNumber,
        companyId,
        tx,
      );
      if (existing)
        throw new BadRequestException(
          `Quotation number "${quotationNumber}" already exists`,
        );

      const rfq = await this.rfqRepository.findById(dto.rfqId, companyId, tx);
      if (!rfq) throw new NotFoundException(`RFQ ${dto.rfqId} not found`);

      // G14-03-06: tenant-scoped supplier validation. Prisma `connect`
      // only guarantees FK existence — never tenant ownership — so a
      // foreign-tenant or soft-deleted supplierId would otherwise be
      // accepted. Missing, foreign-tenant and soft-deleted suppliers are
      // indistinguishable 404s (no tenant-existence oracle). Runs before
      // any mutation, inside the same transaction.
      const supplier = await tx.supplier.findFirst({
        where: {
          id: dto.supplierId,
          companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!supplier) {
        throw new NotFoundException(
          `Supplier with id ${dto.supplierId} not found`,
        );
      }

      // G14-03-06: tenant-scoped product validation (same batched pattern
      // as RFQ create above and the purchase-return G9-E2 precedent:
      // SupplierQuotationItem.productId has no FK in the schema).
      await this.validateProductsBelongToCompany(
        dto.items.map((i) => i.productId),
        companyId,
        tx,
      );

      let subtotal = new Decimal(0);
      let totalDiscount = new Decimal(0);
      let totalTax = new Decimal(0);

      const itemsData = dto.items.map((item) => {
        const unitCost = toDecimal(item.unitCost);
        const qty = new Decimal(item.quantity);
        const discountPct = toDecimal(item.discountPercent);
        const taxPct = toDecimal(item.taxPercent);

        const itemSubtotal = unitCost.mul(qty);
        const itemDiscount = itemSubtotal.mul(discountPct).div(100);
        const itemTax = itemSubtotal.sub(itemDiscount).mul(taxPct).div(100);

        subtotal = subtotal.add(itemSubtotal);
        totalDiscount = totalDiscount.add(itemDiscount);
        totalTax = totalTax.add(itemTax);

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitCost,
          discountPercent:
            item.discountPercent != null
              ? new Decimal(item.discountPercent)
              : null,
          discountAmount: itemDiscount,
          taxPercent:
            item.taxPercent != null ? new Decimal(item.taxPercent) : null,
          taxAmount: itemTax,
          subtotal: itemSubtotal,
          total: itemSubtotal.sub(itemDiscount).add(itemTax),
          notes: item.notes,
        };
      });

      const quotation = await this.repository.create(
        {
          quotationNumber,
          quotationDate: dto.quotationDate
            ? new Date(dto.quotationDate)
            : new Date(),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          status: QuotationStatus.DRAFT,
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          grandTotal: subtotal.sub(totalDiscount).add(totalTax),
          notes: dto.notes,
          company: { connect: { id: companyId } },
          rfq: { connect: { id: dto.rfqId } },
          supplier: { connect: { id: dto.supplierId } },
          items: { create: itemsData },
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'SupplierQuotation',
          entityId: quotation.id,
          action: 'CREATE',
          before: null,
          after: {
            quotationNumber,
            grandTotal: quotation.grandTotal.toString(),
          },
        },
        tx,
      );

      return SupplierQuotationMapper.toEntity(quotation);
    });
  }

  // G14-03-06: batched tenant-scoped product validation. Mirrors the
  // RFQ create helper and the purchase-return G9-E2 / purchase-order
  // G14-03-04 pattern: one query for all distinct requested ids (no N+1);
  // missing, foreign-tenant and soft-deleted products are
  // indistinguishable 404s.
  private async validateProductsBelongToCompany(
    productIds: string[],
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const requestedProductIds = [...new Set(productIds)];
    const foundProducts = await tx.product.findMany({
      where: {
        id: { in: requestedProductIds },
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const foundProductIds = new Set(foundProducts.map((p) => p.id));
    const missingProductId = requestedProductIds.find(
      (id) => !foundProductIds.has(id),
    );
    if (missingProductId !== undefined) {
      throw new NotFoundException(
        `Product with id ${missingProductId} not found`,
      );
    }
  }

  async findAll(
    query: SupplierQuotationQueryDto,
    companyId: string,
  ): Promise<{
    items: SupplierQuotationEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

    const result = await this.repository.findAll({
      companyId,
      search: query.search,
      rfqId: query.rfqId,
      supplierId: query.supplierId,
      status: query.status as QuotationStatus | undefined,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: SupplierQuotationMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<SupplierQuotationEntity> {
    const q = await this.repository.findById(id, companyId);
    if (!q) throw new NotFoundException(`Supplier quotation ${id} not found`);
    return SupplierQuotationMapper.toEntity(q);
  }

  async softDelete(id: string, companyId: string): Promise<void> {
    const existing = await this.repository.findById(id, companyId);
    if (!existing)
      throw new NotFoundException(`Supplier quotation ${id} not found`);
    if (existing.status !== QuotationStatus.DRAFT)
      throw new BadRequestException('Only DRAFT quotations can be deleted');
    await this.repository.softDelete(id, companyId);
  }

  async transitionStatus(
    id: string,
    newStatus: QuotationStatus,
    userId: string,
    companyId: string,
  ): Promise<SupplierQuotationEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const q = await this.repository.findById(id, companyId, tx);
      if (!q) throw new NotFoundException(`Supplier quotation ${id} not found`);

      const current = q.status as QuotationStatus;
      const allowed: Record<QuotationStatus, QuotationStatus[]> = {
        DRAFT: ['SENT', 'CANCELLED'],
        SENT: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
        ACCEPTED: [],
        REJECTED: [],
        CANCELLED: [],
      };
      const allowedTransitions = allowed[current] ?? [];
      if (!allowedTransitions.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${current} to ${newStatus}`,
        );
      }

      const updateData: Prisma.SupplierQuotationUpdateInput = {
        status: newStatus,
      };
      if (newStatus === QuotationStatus.ACCEPTED)
        updateData.acceptedAt = new Date();
      if (newStatus === QuotationStatus.REJECTED)
        updateData.rejectedAt = new Date();

      const updated = await this.repository.update(
        id,
        updateData,
        companyId,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'SupplierQuotation',
          entityId: id,
          action: 'TRANSITION',
          before: { status: current },
          after: { status: newStatus },
        },
        tx,
      );

      return SupplierQuotationMapper.toEntity(updated);
    });
  }
}
