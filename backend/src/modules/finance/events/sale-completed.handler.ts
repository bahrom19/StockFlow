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
 * If no transaction context is provided, the handler logs an error.
 * This should never happen in production — the event publisher always
 * includes the transaction context from the originating sale transaction.
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
      this.logger.error(
        `No transaction context for sale.completed event (saleId=${event.payload.saleId}). Journal entries will NOT be created.`,
      );
      return;
    }

    await this.integration.onSaleCompleted(event.payload, tx);
  }
}
