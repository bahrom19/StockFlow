import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface InventoryAdjustedPayload {
  productId: string;
  companyId: string;
  warehouseId: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string;
  adjustedBy: string;
  referenceType?: string;
  referenceId?: string;
  comment?: string;
  /** Unit cost used for the finance journal (product costPrice at adjust time). */
  unitCost?: string;
  /**
   * G16-N-4 P1-A: authoritative TOTAL financial cost of the adjustment.
   *
   * Optional for backward compatibility: legacy publishers (StockService.adjust)
   * omit it and keep the handler's unitCost × |diff| computation. When present
   * (inventory-count shrinkage: the canonical consumeFifoLayers().totalCost),
   * the finance handler uses it AS-IS as the GL amount instead of re-deriving
   * unitCost × quantity — multi-layer FIFO consumption must not be flattened
   * into an average-unit-cost multiplication (same principle as G16-G
   * SaleItem.fifoCost and the G9-F4 purchase-return FIFO relief).
   */
  totalCost?: string;
  /**
   * G16-N-4 P1-A: audit-only classification of the cost basis behind
   * `totalCost`/`unitCost` ('FIFO' | 'AVERAGE' | 'COST_PRICE' | 'NONE').
   * Never read by the finance handler — observability/audit metadata only.
   */
  costBasis?: 'FIFO' | 'AVERAGE' | 'COST_PRICE' | 'NONE';
}

export class InventoryAdjustedEvent implements DomainEvent<InventoryAdjustedPayload> {
  readonly eventName = 'inventory.adjusted';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: InventoryAdjustedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
