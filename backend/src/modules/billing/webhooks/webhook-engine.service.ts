import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Currency, PaymentTransactionStatus } from '@prisma/client';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { PrismaService } from '../../../common/prisma';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { CompanySubscriptionService } from '../services/company-subscription.service';
import { InvoiceService } from '../services/invoice.service';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import { PaymentSucceededEvent } from '../events/payment-succeeded.event';
import { PaymentFailedEvent } from '../events/payment-failed.event';
import { SubscriptionCancelledEvent } from '../events/subscription-cancelled.event';

const SYSTEM_USER = 'webhook';
const IDEMPOTENCY_TTL_SEC = 86_400; // 24 hours

/**
 * Supported Stripe webhook event types.
 */
const SUPPORTED_EVENTS = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.refunded',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
] as const;

type StripeEventType = (typeof SUPPORTED_EVENTS)[number];

interface WebhookPayload {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
  created: number;
  idempotency_key?: string;
}

/**
 * Stripe webhook engine with:
 * - Constant-time signature verification
 * - Dual-store idempotency (Redis + DB)
 * - Transaction-safe event handling via services/repositories
 */
@Injectable()
export class WebhookEngineService {
  private readonly logger = new Logger(WebhookEngineService.name);
  private readonly webhookSecret: string;
  private readonly isDevelopment: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly companySubscriptionService: CompanySubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly subscriptionRepository: CompanySubscriptionRepository,
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {
    this.webhookSecret = this.configService.get<string>(
      'app.stripeWebhookSecret',
      '',
    );
    this.isDevelopment = !this.webhookSecret;
    if (this.isDevelopment) {
      this.logger.warn(
        'Webhook engine in DEVELOPMENT mode — signature verification disabled',
      );
    }
  }

  /**
   * Verify Stripe webhook signature using constant-time HMAC-SHA256 comparison.
   * Accepts Stripe's standard format: t=timestamp,v1=signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (this.isDevelopment) return true;

    try {
      const parts = signature
        .split(',')
        .reduce<Record<string, string>>((acc, part) => {
          const [key, value] = part.split('=');
          if (key) acc[key] = value ?? '';
          return acc;
        }, {});

      const timestamp = parts['t'];
      const expectedSig = parts['v1'];
      if (!timestamp || !expectedSig) return false;

      const signedPayload = `${timestamp}.${payload}`;
      const computedSig = createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      return timingSafeEqual(
        Buffer.from(computedSig, 'hex'),
        Buffer.from(expectedSig, 'hex'),
      );
    } catch (error) {
      this.logger.error(`Signature verification failed: ${error}`);
      return false;
    }
  }

  /**
   * Process an incoming webhook event with idempotency and dispatch.
   */
  async handleWebhook(
    payload: WebhookPayload,
  ): Promise<{ handled: boolean; eventType: string }> {
    const { id: eventId, type } = payload;

    if (!SUPPORTED_EVENTS.includes(type as StripeEventType)) {
      return { handled: false, eventType: type };
    }

    // Idempotency check
    const idempotencyKey = payload.idempotency_key ?? `stripe:${eventId}`;
    if (await this.isAlreadyProcessed(idempotencyKey)) {
      this.logger.log(`Duplicate webhook: ${eventId} (${type})`);
      return { handled: true, eventType: type };
    }

    try {
      switch (type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(payload.data.object);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(payload.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(payload.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(payload.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(payload.data.object);
          break;
        case 'charge.refunded':
          await this.handleChargeRefunded(payload.data.object);
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(payload.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(payload.data.object);
          break;
      }

      await this.markProcessed(idempotencyKey);
      this.logger.log(`Webhook handled: ${eventId} (${type})`);
      return { handled: true, eventType: type };
    } catch (error) {
      this.logger.error(`Webhook failed: ${eventId} (${type}): ${error}`);
      throw error; // Re-throw for Stripe retry (returns 500)
    }
  }

  // ─── Individual Event Handlers ──────────────────────────────────

  private async handleCheckoutSessionCompleted(
    object: Record<string, unknown>,
  ): Promise<void> {
    const sessionId = object.id as string;
    const customerId = object.customer as string;
    const subscriptionId = object.subscription as string;
    const metadata = (object.metadata ?? {}) as Record<string, string>;
    const companyId = metadata['companyId'];
    const planCode = metadata['planCode'];

    if (!companyId || !planCode) {
      this.logger.warn(`Checkout session ${sessionId} missing metadata`);
      return;
    }

    // Activate subscription (trial → active) if currently in trial or past_due
    const existingSub =
      await this.subscriptionRepository.findByCompany(companyId);
    if (existingSub && existingSub.status !== 'ACTIVE') {
      await this.companySubscriptionService.transitionStatus(
        companyId,
        'ACTIVE',
        SYSTEM_USER,
      );
    }

    // Store provider references
    if (existingSub && (customerId || subscriptionId)) {
      await this.subscriptionRepository.updateByCompany(companyId, {
        providerCustomerId: customerId ?? existingSub.providerCustomerId,
        providerSubscriptionId:
          subscriptionId ?? existingSub.providerSubscriptionId,
      });
    }
  }

  private async handleInvoicePaid(
    object: Record<string, unknown>,
  ): Promise<void> {
    const providerInvoiceId = object.id as string;
    const paymentIntentId = object.payment_intent as string;
    const amountPaid = (object.amount_paid as number) ?? 0;
    const currency = (object.currency as string) ?? 'usd';

    const invoice = await this.prismaService.invoice.findFirst({
      where: { providerInvoiceId },
    });

    if (invoice) {
      // Stripe amounts are in cents — convert to decimal string
      const amountStr = (amountPaid / 100).toFixed(4);
      await this.invoiceService.markPaid(
        invoice.id,
        invoice.companyId,
        amountStr,
        providerInvoiceId,
      );
    }
  }

  private async handleInvoicePaymentFailed(
    object: Record<string, unknown>,
  ): Promise<void> {
    const providerInvoiceId = object.id as string;
    const attemptCount = (object.attempt_count as number) ?? 0;

    const invoice = await this.prismaService.invoice.findFirst({
      where: { providerInvoiceId },
    });

    if (invoice) {
      await this.eventBus.publish(
        new PaymentFailedEvent({
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          amount: invoice.totalAmount.toString(),
          currency: invoice.currency,
          reason: `Payment failed after ${attemptCount} attempts`,
        }),
      );
      await this.companySubscriptionService.transitionStatus(
        invoice.companyId,
        'PAST_DUE',
        SYSTEM_USER,
      );
    }
  }

  private async handleSubscriptionUpdated(
    object: Record<string, unknown>,
  ): Promise<void> {
    const status = object.status as string;
    const providerSubscriptionId = object.id as string;

    const subs = await this.prismaService.companySubscription.findMany({
      where: { providerSubscriptionId },
    });
    const sub = subs[0];
    if (!sub) return;

    if (status === 'past_due') {
      await this.companySubscriptionService.transitionStatus(
        sub.companyId,
        'PAST_DUE',
        SYSTEM_USER,
      );
    } else if (status === 'active' && sub.status === 'PAST_DUE') {
      await this.companySubscriptionService.transitionStatus(
        sub.companyId,
        'ACTIVE',
        SYSTEM_USER,
      );
    }
  }

  private async handleSubscriptionDeleted(
    object: Record<string, unknown>,
  ): Promise<void> {
    const providerSubscriptionId = object.id as string;

    const subs = await this.prismaService.companySubscription.findMany({
      where: { providerSubscriptionId },
    });
    const sub = subs[0];
    if (!sub) return;

    await this.companySubscriptionService.cancel(
      sub.companyId,
      'Provider subscription deleted',
      SYSTEM_USER,
    );
    await this.eventBus.publish(
      new SubscriptionCancelledEvent({
        companyId: sub.companyId,
        subscriptionId: sub.id,
        reason: 'Provider subscription deleted',
      }),
    );
  }

  private async handleChargeRefunded(
    object: Record<string, unknown>,
  ): Promise<void> {
    const paymentIntentId = object.payment_intent as string;
    const amountRefunded = (object.amount_refunded as number) ?? 0;
    const currency = (object.currency as string) ?? 'usd';

    const tx =
      await this.paymentTransactionRepository.findByInvoice(paymentIntentId);
    const paymentTx = tx[0];
    if (!paymentTx?.invoiceId) return;

    const invoice = await this.prismaService.invoice.findUnique({
      where: { id: paymentTx.invoiceId },
    });
    if (!invoice) return;

    // Create refund transaction via repository
    await this.paymentTransactionRepository.create({
      company: { connect: { id: paymentTx.companyId } },
      subscription: { connect: { id: paymentTx.subscriptionId } },
      invoice: { connect: { id: paymentTx.invoiceId } },
      amount: (amountRefunded / 100).toFixed(4),
      currency: currency.toUpperCase() as Currency,
      status: 'REFUNDED' as PaymentTransactionStatus,
      method: 'stripe',
      providerPaymentId: `refund_${paymentIntentId}`,
      reference: `Refund for ${invoice.invoiceNumber}`,
    });
  }

  private async handlePaymentIntentSucceeded(
    _object: Record<string, unknown>,
  ): Promise<void> {
    // Handled by invoice.paid event — no action needed
  }

  private async handlePaymentIntentFailed(
    object: Record<string, unknown>,
  ): Promise<void> {
    const paymentIntentId = object.id as string;
    const lastError =
      (object.last_payment_error as Record<string, unknown>) ?? {};
    const message = (lastError.message as string) ?? 'Unknown error';

    this.logger.warn(`Payment intent ${paymentIntentId} failed: ${message}`);

    const tx =
      await this.paymentTransactionRepository.findByInvoice(paymentIntentId);
    const paymentTx = tx[0];
    if (!paymentTx?.invoiceId) return;

    await this.eventBus.publish(
      new PaymentFailedEvent({
        companyId: paymentTx.companyId,
        invoiceId: paymentTx.invoiceId,
        amount: paymentTx.amount.toString(),
        currency: paymentTx.currency,
        reason: message,
      }),
    );
  }

  // ─── Idempotency ────────────────────────────────────────────────

  /**
   * Check if a webhook event has already been processed.
   * Uses Redis for speed, then falls back to DB.
   */
  private async isAlreadyProcessed(key: string): Promise<boolean> {
    const cached = await this.cacheService.get<string>(`webhook:idem:${key}`);
    if (cached === 'processed') return true;

    const dbRecord = await this.prismaService.webhookEvent
      .findUnique({ where: { idempotencyKey: key } })
      .catch(() => null);
    return dbRecord !== null;
  }

  /**
   * Mark a webhook event as processed in both Redis and DB.
   */
  private async markProcessed(key: string): Promise<void> {
    await this.cacheService.set(
      `webhook:idem:${key}`,
      'processed',
      IDEMPOTENCY_TTL_SEC,
    );

    await this.prismaService.webhookEvent
      .upsert({
        where: { idempotencyKey: key },
        create: { idempotencyKey: key, processedAt: new Date() },
        update: { processedAt: new Date() },
      })
      .catch((err: Error) => {
        this.logger.warn(`Idempotency DB write failed: ${err.message}`);
      });
  }
}
