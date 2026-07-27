import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../common/events/domain-event.interface';

export class CustomerCreditLimitChangedEvent implements DomainEvent {
  public readonly eventName = 'customer.credit.limit.changed';
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly payload: any;

  constructor(
    public readonly customerId: string,
    public readonly companyId: string,
    previousLimit: string,
    newLimit: string,
    changedBy: string,
    public readonly transactionClient?: any,
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.payload = {
      customerId,
      companyId,
      previousLimit,
      newLimit,
      changedBy,
    };
  }
}
