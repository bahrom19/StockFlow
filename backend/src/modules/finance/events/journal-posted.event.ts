import { DomainEvent } from '../../../common/events';
import { randomUUID } from 'crypto';

export interface JournalPostedPayload {
  journalEntryId: string;
  companyId: string;
  financialPeriodId: string;
  entryNumber: number;
  entryDate: Date;
  description: string | null;
  totalDebit: string;
  totalCredit: string;
  referenceType: string | null;
  referenceId: string | null;
  postedBy: string;
  postedAt: Date;
  lines: Array<{
    id: string;
    accountId: string;
    debit: string;
    credit: string;
    description: string | null;
  }>;
}

export class JournalPostedEvent implements DomainEvent<JournalPostedPayload> {
  readonly eventName = 'journal.posted';
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(readonly payload: JournalPostedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
  }
}
