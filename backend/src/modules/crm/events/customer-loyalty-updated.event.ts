import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../common/events/domain-event.interface';

export class CustomerLoyaltyUpdatedEvent implements DomainEvent {
  public readonly eventName = 'customer.loyalty.updated';
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly payload: any;

  constructor(
    public readonly customerId: string,
    public readonly companyId: string,
    pointsBefore: number,
    pointsAfter: number,
    transactionType: string,
    referenceId: string,
    public readonly transactionClient?: any,
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.payload = {
      customerId,
      companyId,
      pointsBefore,
      pointsAfter,
      transactionType,
      referenceId,
    };
  }
}
