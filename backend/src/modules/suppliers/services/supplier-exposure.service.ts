import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import {
  SupplierExposureRepository,
  SupplierExposureCurrencyRow,
} from '../repositories/supplier-exposure.repository';
import {
  SupplierExposureEntity,
  SupplierExposureCurrencyEntity,
} from '../entities/supplier-exposure.entity';
import { CompaniesService } from '../../companies/services/companies.service';

/**
 * G9-D3: Supplier Open-PO Exposure — READ-ONLY observability only.
 *
 * Answers: what additional financial obligation do this supplier's open /
 * received purchase orders create beyond the AP that already exists?
 *
 * Canonical metric (per PO, floor-guarded):
 *   uninvoiced = max(PO.grandTotal − Σ(active APPROVED/PAID invoice
 *                                     grandTotal for that PO), 0)
 *
 * Included PO statuses: APPROVED, ORDERED, PARTIALLY_RECEIVED, RECEIVED.
 * Excluded: DRAFT, PENDING, CANCELLED, soft-deleted.
 *
 * Hard rules enforced here:
 *  - Tenant safety mirrors the G9-D1 pattern: supplier lookup is scoped by
 *    id + companyId with soft-delete exclusion; cross-company access falls
 *    into the same not-found behavior.
 *  - The headline `uninvoicedOpenPo` / `committedOpenPo` are read from the
 *    base-currency group only (G9-D1 contract: PO and invoice currencies are
 *    enforced == company currency at write time). Non-base groups would only
 *    appear in the defensive `byCurrency` breakdown — never mixed into the
 *    headline arithmetic.
 *  - All monetary values are Decimal-derived and serialized as strings; no
 *    JS floating-point money.
 *  - Derived values only — nothing is persisted, no new columns, no
 *    paidAmount reads (neither PO nor invoice), no GoodsReceipt money.
 *  - Canonical AP (G9-B1) and the G9-D1 credit summary semantics are NOT
 *    touched by this read model.
 */
@Injectable()
export class SupplierExposureService {
  constructor(
    private readonly suppliersRepo: SuppliersRepository,
    private readonly exposureRepo: SupplierExposureRepository,
    private readonly companiesService: CompaniesService,
  ) {}

  async getOpenPoExposure(
    supplierId: string,
    companyId: string,
  ): Promise<SupplierExposureEntity> {
    // Tenant-scoped lookup (id + companyId, soft-deleted excluded).
    // Cross-company access falls into the same not-found behavior (D1).
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // G9-D1 contract: base currency only for the headline numbers.
    const baseCurrency = await this.companiesService.getBaseCurrency(
      companyId,
    );

    const rows: SupplierExposureCurrencyRow[] =
      await this.exposureRepo.getOpenPoExposureAggregates(
        supplierId,
        companyId,
      );

    const groups: SupplierExposureCurrencyEntity[] = rows.map((row) => ({
      currency: row.currency,
      committedOpenPo: row.committedOpenPo,
      uninvoicedOpenPo: row.uninvoicedOpenPo,
      openPoCount: row.openPoCount,
    }));

    const baseGroup = groups.find((g) => g.currency === baseCurrency) ?? {
      currency: baseCurrency,
      committedOpenPo: new Decimal(0).toString(),
      uninvoicedOpenPo: new Decimal(0).toString(),
      openPoCount: 0,
    };

    return {
      supplierId,
      currency: baseCurrency,
      uninvoicedOpenPo: baseGroup.uninvoicedOpenPo,
      committedOpenPo: baseGroup.committedOpenPo,
      openPoCount: baseGroup.openPoCount,
      byCurrency: groups,
    };
  }
}
