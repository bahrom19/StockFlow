import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One monetary group of the G9-D3 Supplier Open-PO Exposure read model.
 *
 * All monetary values are Decimal-derived and serialized as strings; no
 * JavaScript floating-point money. Amounts are grouped per currency — never
 * mixed arithmetically, no FX conversion.
 */
export class SupplierExposureCurrencyEntity {
  @ApiProperty({ example: 'KZT' })
  currency!: string;

  /**
   * Σ PO.grandTotal over the included open/received statuses — the full
   * committed-order value. NOT reduced by invoiced amounts.
   */
  @ApiProperty({ example: '1500000.0000' })
  committedOpenPo!: string;

  /**
   * Σ max(PO.grandTotal − Σ(active APPROVED/PAID invoice grandTotal), 0)
   * over the included statuses — the AP-compatible uninvoiced remainder.
   * G9-D2 guards the invariant; the floor is defence-in-depth.
   */
  @ApiProperty({ example: '800000.0000' })
  uninvoicedOpenPo!: string;

  /** Number of included open/received POs in this currency group. */
  @ApiProperty({ example: 3 })
  openPoCount!: number;
}

/**
 * G9-D3: Supplier Open-PO Exposure — read-only observability read model
 * (same style as the G9-D1 credit summary: derived at read time, nothing
 * persisted, no enforcement).
 *
 * Open-PO exposure = future financial obligation from committed/received
 * purchase orders. It is deliberately kept SEPARATE from the canonical AP
 * outstanding (G9-B1) and never mixed with it arithmetically here.
 */
export class SupplierExposureEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  /**
   * The company base currency (G9-D1 contract preserved: PO and invoice
   * currencies are enforced == company currency at write time). A defensive
   * `byCurrency` breakdown is still provided in case data ever exists in a
   * non-base currency; no FX conversion is performed and currency groups are
   * never mixed arithmetically.
   */
  @ApiProperty({ example: 'KZT' })
  currency!: string;

  /**
   * Headline exposure — Σ uninvoiced remainders over included POs in the
   * base currency group. This is the amount NOT yet counted in canonical AP
   * (approved/paid invoices are excluded per PO by construction).
   */
  @ApiProperty({ example: '800000.0000' })
  uninvoicedOpenPo!: string;

  /**
   * Σ PO.grandTotal over included open/received POs in the base currency
   * group — full committed-order value, NOT reduced by invoicing.
   */
  @ApiProperty({ example: '1500000.0000' })
  committedOpenPo!: string;

  /** Number of included open/received POs (base currency group). */
  @ApiProperty({ example: 3 })
  openPoCount!: number;

  /**
   * Defensive per-currency breakdown. In the current architecture this
   * contains exactly the base-currency group; it exists so a future
   * multi-currency drift cannot silently mix currencies in the headline.
   */
  @ApiPropertyOptional({ type: [SupplierExposureCurrencyEntity] })
  byCurrency!: SupplierExposureCurrencyEntity[];
}
