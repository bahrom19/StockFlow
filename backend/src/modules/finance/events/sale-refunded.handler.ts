import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../../common/events';
import { SaleRefundedEvent } from '../../sales/events/sale-refunded.event';
import { FinanceIntegrationService } from '../services/finance-integration.service';

/**
 * Handles {@code SaleRefundedEvent} by creating reversal journal entries.
 *
 * Requires a {@code Prisma.TransactionClient} in the context so the
 * reversal entries are created inside the same database transaction
 * as the refund status update.
 */
@Injectable()
export class SaleRefundedEventHandler implements EventHandler<SaleRefundedEvent> {
  private readonly logger = new Logger(SaleRefundedEventHandler.name);

  constructor(private readonly integration: FinanceIntegrationService) {}

  async handle(
    event: SaleRefundedEvent,
    context?: Record<string, any>,
  ): Promise<void> {
    const tx = context?.transactionClient;
    if (!tx) {
      this.logger.error(
        `No transaction context for sale.refunded event (saleId=${event.payload.saleId}). Reversal journal entries will NOT be created.`,
      );
      return;
    }

    await this.integration.onSaleRefunded(event.payload, tx);
  }
}
