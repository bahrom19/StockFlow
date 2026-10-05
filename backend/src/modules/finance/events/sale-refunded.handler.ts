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
 *
 * G16-N-4 P2 idempotency — FAIL CLOSED on a missing transaction context
 * (was log-and-skip, which silently lost the reversal journal), and the
 * event occurrence id (`eventId`) is threaded in as `clientOperationId`
 * so a duplicate delivery is rejected by the existing
 * `@@unique([companyId, clientOperationId])` constraint rather than
 * reversing the sale a second time.
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
      throw new Error(
        `No transaction context for sale.refunded event (saleId=${event.payload.saleId}). The reversal journal cannot be posted outside the refund transaction.`,
      );
    }

    await this.integration.onSaleRefunded(event.payload, tx, event.eventId);
  }
}
