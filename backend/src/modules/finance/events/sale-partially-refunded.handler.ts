import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../../common/events';
import { SalePartiallyRefundedEvent } from '../../sales/events/sale-partially-refunded.event';
import { FinanceIntegrationService } from '../services/finance-integration.service';

/**
 * G11-E4 — handles `sale.partially_refunded` by posting the partial refund's
 * GL journal (Revenue reversal, interim Cash payout, Inventory/COGS reversal
 * at the canonical payload fifoCost).
 *
 * Requires a {@code Prisma.TransactionClient} in the context so the journal
 * commits or rolls back with the refund itself. Unlike the legacy full-refund
 * handler (which logs-and-skips without a tx), the partial path FAILS FAST:
 * a refund without a transaction context is a publisher contract violation
 * and must abort the whole operation rather than silently lose the journal.
 */
@Injectable()
export class SalePartiallyRefundedEventHandler
  implements EventHandler<SalePartiallyRefundedEvent>
{
  private readonly logger = new Logger(SalePartiallyRefundedEventHandler.name);

  constructor(private readonly integration: FinanceIntegrationService) {}

  async handle(
    event: SalePartiallyRefundedEvent,
    context?: Record<string, any>,
  ): Promise<void> {
    const tx = context?.transactionClient;
    if (!tx) {
      // Fail fast — the publisher always provides the transaction client;
      // posting outside the refund transaction would break atomicity.
      throw new Error(
        `No transaction context for sale.partially_refunded event (refundId=${event.payload.refundId}). Partial refund journal cannot be posted outside the refund transaction.`,
      );
    }

    await this.integration.onSalePartiallyRefunded(event.payload, tx);
  }
}
