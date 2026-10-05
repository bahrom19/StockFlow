import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../../common/events';
import { SaleCompletedEvent } from '../../sales/events/sale-completed.event';
import { FinanceIntegrationService } from '../services/finance-integration.service';

/**
 * Handles {@code SaleCompletedEvent} by creating accounting journal entries.
 *
 * Requires a {@code Prisma.TransactionClient} in the context so the
 * journal entries are created inside the same database transaction
 * as the sale completion.
 *
 * G16-N-4 P2 idempotency — FAIL CLOSED. The handler previously logged an
 * error and returned when no transaction context was present, silently
 * dropping the revenue + COGS journal for a completed sale. That is a
 * financial-integrity failure mode, not a tolerable degradation: the sale
 * commits with stock decremented and no accounting entry. The publisher
 * always supplies the context, so the branch is unreachable in production
 * and failing loudly is the correct behaviour.
 *
 * G16-N-4 P2 idempotency — the event occurrence id (`eventId`) is threaded
 * into the journal as `clientOperationId`, so a duplicate delivery is
 * rejected by the existing `@@unique([companyId, clientOperationId])`
 * constraint instead of double-posting and double-counting balances.
 */
@Injectable()
export class SaleCompletedEventHandler implements EventHandler<SaleCompletedEvent> {
  private readonly logger = new Logger(SaleCompletedEventHandler.name);

  constructor(private readonly integration: FinanceIntegrationService) {}

  async handle(
    event: SaleCompletedEvent,
    context?: Record<string, any>,
  ): Promise<void> {
    const tx = context?.transactionClient;
    if (!tx) {
      throw new Error(
        `No transaction context for sale.completed event (saleId=${event.payload.saleId}). The sale journal cannot be posted outside the sale transaction.`,
      );
    }

    await this.integration.onSaleCompleted(event.payload, tx, event.eventId);
  }
}
