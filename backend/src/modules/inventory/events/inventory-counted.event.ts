import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface InventoryCountedPayload {
  productId: string;
  companyId: string;
  warehouseId: string;
  expectedQuantity: number;
  actualQuantity: number;
  difference: number;
  countNumber: string;
  countedBy: string;
}

export class InventoryCountedEvent implements DomainEvent<InventoryCountedPayload> {
  readonly eventName = 'inventory.counted';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: InventoryCountedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
