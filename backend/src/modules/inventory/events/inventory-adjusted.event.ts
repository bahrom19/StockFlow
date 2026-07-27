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
