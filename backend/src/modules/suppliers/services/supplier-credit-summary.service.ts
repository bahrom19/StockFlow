import { Injectable, NotFoundException } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierCreditSummaryRepository } from '../repositories/supplier-credit-summary.repository';
import { SupplierCreditSummaryEntity } from '../entities/supplier-credit-summary.entity';
import { CompaniesService } from '../../companies/services/companies.service';

/**
 * G9-D1: Supplier Credit Summary — READ-ONLY observability only.
 *
 * Makes Supplier.creditLimit (data-only since G9-C) observable:
 *   creditLimit, outstandingAP, availableCredit, utilizationPercent,
 *   currency — all in the COMPANY BASE CURRENCY.
 *
 * Hard rules enforced here:
 *  - null creditLimit is NOT treated as 0 → availableCredit/utilization
 *    are null, outstandingAP is still returned.
 *  - creditLimit = 0 is an explicit zero limit → availableCredit = 0 −
 *    outstandingAP (may be negative), utilizationPercent = null
 *    (percentage over a zero limit is mathematically undefined — never
 *    divide by zero).
 *  - creditLimit > 0 → utilization = outstanding / limit * 100 (Decimal
 *    arithmetic, 2dp) — even when the supplier is over its limit
 *    (availableCredit goes negative). Over-limit is NOT an error and
 *    blocks/changes nothing: no PO/invoice/payment enforcement, no 409.
 *  - All amounts are Decimal-derived and serialized as strings; no JS
 *    floating-point money.
 *  - Derived values only — nothing is persisted, no new columns, no
 *    paidAmount cache reads.
 */
@Injectable()
export class SupplierCreditSummaryService {
  constructor(
    private readonly suppliersRepo: SuppliersRepository,
    private readonly creditSummaryRepo: SupplierCreditSummaryRepository,
    private readonly companiesService: CompaniesService,
  ) {}

  async getCreditSummary(
    supplierId: string,
    companyId: string,
  ): Promise<SupplierCreditSummaryEntity> {
    // Tenant-scoped lookup (id + companyId, soft-deleted excluded).
    // Cross-company access falls into the same not-found behavior.
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // G9-D1 critical rule: base currency only.
    const currency = (await this.companiesService.getBaseCurrency(
      companyId,
    )) as Currency;

    const { totalInvoiced, totalAllocated, totalReturned } =
      await this.creditSummaryRepo.getBaseCurrencyTotals(
        supplierId,
        companyId,
        currency,
      );

    // Canonical AP model (unchanged), restricted to the base currency.
    const outstandingAP = totalInvoiced
      .sub(totalAllocated)
      .sub(totalReturned);

    // null = limit not configured — explicitly different from 0.
    const creditLimit =
      supplier.creditLimit == null ? null : new Decimal(supplier.creditLimit);

    let availableCredit: Decimal | null = null;
    let utilizationPercent: string | null = null;

    if (creditLimit !== null) {
      // 0 − outstandingAP for an explicit zero limit; creditLimit −
      // outstandingAP otherwise. Negative availableCredit is allowed and
      // is not an error (read-only over-limit observability).
      availableCredit = creditLimit.minus(outstandingAP);
      utilizationPercent = creditLimit.isZero()
        ? null // zero limit → percentage undefined, no division by zero
        : outstandingAP.div(creditLimit).mul(100).toFixed(2);
    }

    return {
      supplierId,
      creditLimit: creditLimit?.toString() ?? null,
      outstandingAP: outstandingAP.toString(),
      availableCredit: availableCredit?.toString() ?? null,
      utilizationPercent,
      currency,
    };
  }
}