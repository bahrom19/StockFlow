import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface InventoryTransferredPayload {
  productId: string;
  companyId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  transferredBy: string;
  comment?: string;
}

export class InventoryTransferredEvent implements DomainEvent<InventoryTransferredPayload> {
  readonly eventName = 'inventory.transferred';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: InventoryTransferredPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
