import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Currency, PaymentTransactionStatus, Prisma } from '@prisma/client';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { PrismaService } from '../../../common/prisma';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { CompanySubscriptionService } from '../services/company-subscription.service';
import { InvoiceService } from '../services/invoice.service';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import { PaymentSucceededEvent } from '../events/payment-succeeded.event';
import { PaymentFailedEvent } from '../events/payment-failed.event';

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
 * Minimal event context threaded into state-changing webhook handlers so
 * already-applied convergence remains observable (event type/id in logs).
 */
interface WebhookHandlerContext {
  eventId: string;
  eventType: string;
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
  private readonly skipSignatureVerification: boolean;

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
    // G13-03-08-01: explicit opt-in bypass only. A missing secret NEVER
    // disables verification implicitly — it fails closed (see below).
    this.skipSignatureVerification = this.configService.get<boolean>(
      'app.stripeWebhookSkipVerify',
      false,
    );
    if (this.skipSignatureVerification) {
      this.logger.warn(
        'Stripe webhook signature verification DISABLED via explicit opt-in — never enable in production',
      );
    }
  }

  /**
   * Verify Stripe webhook signature using constant-time HMAC-SHA256 comparison.
   * Accepts Stripe's standard format: t=timestamp,v1=signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (this.skipSignatureVerification) return true;

    // G13-03-08-01: fail closed — an unconfigured secret rejects every
    // webhook instead of silently accepting it.
    if (!this.webhookSecret) {
      this.logger.error(
        'Stripe webhook secret is not configured — rejecting webhook',
      );
      return false;
    }

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
      const ctx: WebhookHandlerContext = { eventId, eventType: type };
      switch (type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(payload.data.object, ctx);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(payload.data.object, ctx);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(payload.data.object, ctx);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(payload.data.object, ctx);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(payload.data.object, ctx);
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

  /**
   * G13-03-09-01: handler-local already-applied convergence for subscription
   * transitions. Runs the transition; if the service throws BadRequest or
   * Conflict (stale/duplicate delivery, CAS race), re-reads the CURRENT
   * persisted status and converges to success ONLY when it already equals
   * one of the expected end-states. Anything else rethrows the ORIGINAL
   * error, preserving retry semantics for genuine failures. The normal
   * markProcessed flow then runs via the caller.
   */
  private async transitionSubscriptionConverged(
    ctx: WebhookHandlerContext,
    companyId: string,
    expectedStatuses: string[],
    transition: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await transition();
    } catch (error) {
      if (
        (error instanceof BadRequestException ||
          error instanceof ConflictException) &&
        expectedStatuses.includes(
          (await this.readSubscriptionStatus(companyId)) ?? '',
        )
      ) {
        this.logger.warn(
          `Stripe webhook ${ctx.eventType} ${ctx.eventId} already applied ` +
            `for company ${companyId} — converging retry as handled`,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Fresh subscription status read for convergence checks. Read failures
   * yield null so the caller rethrows the original error (safe direction:
   * never converge on unreadable state).
   */
  private async readSubscriptionStatus(
    companyId: string,
  ): Promise<string | null> {
    try {
      const sub =
        await this.subscriptionRepository.findByCompany(companyId);
      return sub?.status ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Fresh invoice status read for convergence checks. Same null-on-failure
   * contract as readSubscriptionStatus.
   */
  private async readInvoiceStatus(
    invoiceId: string,
    companyId: string,
  ): Promise<string | null> {
    try {
      const invoice = await this.prismaService.invoice.findFirst({
        where: { id: invoiceId, companyId },
        select: { status: true },
      });
      return invoice?.status ?? null;
    } catch {
      return null;
    }
  }

  private async handleCheckoutSessionCompleted(
    object: Record<string, unknown>,
    ctx: WebhookHandlerContext,
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

    // Activate subscription (trial → active) if currently in trial or past_due.
    // G13-03-09-01: a duplicate/retry delivery finds the subscription
    // already ACTIVE; converge it instead of failing, then still ensure the
    // provider references below (idempotent same-value write).
    const existingSub =
      await this.subscriptionRepository.findByCompany(companyId);
    if (existingSub && existingSub.status !== 'ACTIVE') {
      await this.transitionSubscriptionConverged(
        ctx,
        companyId,
        ['ACTIVE'],
        () =>
          this.companySubscriptionService.transitionStatus(
            companyId,
            'ACTIVE',
            SYSTEM_USER,
          ),
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
    ctx: WebhookHandlerContext,
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
      try {
        await this.invoiceService.markPaid(
          invoice.id,
          invoice.companyId,
          amountStr,
          providerInvoiceId,
        );
      } catch (error) {
        // G13-03-09-01: a retry after the payment was already recorded finds
        // the invoice PAID. Converge only on PAID — any other status (e.g.
        // CANCELLED/voided) is a genuine mismatch and must keep retrying.
        if (
          (error instanceof BadRequestException ||
            error instanceof ConflictException) &&
          ((await this.readInvoiceStatus(
            invoice.id,
            invoice.companyId,
          )) === 'PAID')
        ) {
          this.logger.warn(
            `Stripe webhook ${ctx.eventType} ${ctx.eventId} already applied ` +
              `for invoice ${invoice.id} (already PAID) — converging retry as handled`,
          );
          return;
        }
        throw error;
      }
    }
  }

  private async handleInvoicePaymentFailed(
    object: Record<string, unknown>,
    ctx: WebhookHandlerContext,
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
      // G13-03-09-01: converge a retry that finds the subscription already
      // PAST_DUE; any other state rethrows for normal retry semantics.
      await this.transitionSubscriptionConverged(
        ctx,
        invoice.companyId,
        ['PAST_DUE'],
        () =>
          this.companySubscriptionService.transitionStatus(
            invoice.companyId,
            'PAST_DUE',
            SYSTEM_USER,
          ),
      );
    }
  }

  private async handleSubscriptionUpdated(
    object: Record<string, unknown>,
    ctx: WebhookHandlerContext,
  ): Promise<void> {
    const status = object.status as string;
    const providerSubscriptionId = object.id as string;

    const subs = await this.prismaService.companySubscription.findMany({
      where: { providerSubscriptionId },
    });
    const sub = subs[0];
    if (!sub) return;

    if (status === 'past_due') {
      // G13-03-09-01: converge already-applied retries; see helper.
      await this.transitionSubscriptionConverged(
        ctx,
        sub.companyId,
        ['PAST_DUE'],
        () =>
          this.companySubscriptionService.transitionStatus(
            sub.companyId,
            'PAST_DUE',
            SYSTEM_USER,
          ),
      );
    } else if (status === 'active' && sub.status === 'PAST_DUE') {
      await this.transitionSubscriptionConverged(
        ctx,
        sub.companyId,
        ['ACTIVE'],
        () =>
          this.companySubscriptionService.transitionStatus(
            sub.companyId,
            'ACTIVE',
            SYSTEM_USER,
          ),
      );
    }
  }

  private async handleSubscriptionDeleted(
    object: Record<string, unknown>,
    ctx: WebhookHandlerContext,
  ): Promise<void> {
    const providerSubscriptionId = object.id as string;

    const subs = await this.prismaService.companySubscription.findMany({
      where: { providerSubscriptionId },
    });
    const sub = subs[0];
    if (!sub) return;

    await this.transitionSubscriptionConverged(
      ctx,
      sub.companyId,
      ['CANCELLED', 'EXPIRED'],
      () =>
        this.companySubscriptionService.cancel(
          sub.companyId,
          'Provider subscription deleted',
          SYSTEM_USER,
        ),
    );
    // G13-03-08-02: no handler-level SubscriptionCancelledEvent here.
    // cancel() already publishes exactly one event inside its transaction
    // after the successful CAS transition (canonical owner).
  }

  private async handleChargeRefunded(
    object: Record<string, unknown>,
  ): Promise<void> {
    const chargeId = object.id as string;
    // For invoice-driven payments the charge carries OUR Stripe invoice id.
    // Our Invoice.providerInvoiceId stores exactly this value (see
    // InvoiceService.markPaid via handleInvoicePaid), so it is the correct,
    // tenant-consistent linkage: Stripe invoice ids are globally unique.
    const providerInvoiceId = object.invoice as string | undefined;
    const amountRefunded = (object.amount_refunded as number) ?? 0;
    const currency = (object.currency as string) ?? 'usd';

    // G13-03-08-03: never query with a missing key — an undefined filter
    // would degrade to an unfiltered lookup and attach the refund to an
    // arbitrary transaction.
    if (typeof chargeId !== 'string' || chargeId.length === 0) {
      this.logger.warn('Charge refunded event without charge id — skipping');
      return;
    }
    if (
      typeof providerInvoiceId !== 'string' ||
      providerInvoiceId.length === 0
    ) {
      this.logger.warn(
        `Charge ${chargeId} has no linked Stripe invoice — skipping refund record`,
      );
      return;
    }

    const invoice = await this.prismaService.invoice.findFirst({
      where: { providerInvoiceId },
      select: {
        id: true,
        companyId: true,
        subscriptionId: true,
        invoiceNumber: true,
      },
    });
    if (!invoice) {
      this.logger.warn(
        `Charge ${chargeId} references unknown Stripe invoice ${providerInvoiceId} — skipping refund record`,
      );
      return;
    }

    // G13-03-08-03: deterministic effect-level idempotency key. Stable
    // across redeliveries of the same event (same charge snapshot), distinct
    // across distinct refund operations (the cumulative amount differs), so
    // the DB UNIQUE constraint below turns sequential, concurrent and
    // crash-retry duplicates into a no-op. No migration needed — the column
    // is already UNIQUE.
    const idempotencyKey = `stripe-refund:${chargeId}:${amountRefunded}`;
    try {
      await this.paymentTransactionRepository.create({
        company: { connect: { id: invoice.companyId } },
        subscription: { connect: { id: invoice.subscriptionId } },
        invoice: { connect: { id: invoice.id } },
        amount: (amountRefunded / 100).toFixed(4),
        currency: currency.toUpperCase() as Currency,
        status: 'REFUNDED' as PaymentTransactionStatus,
        method: 'stripe',
        idempotencyKey,
        providerPaymentId: `refund_${chargeId}`,
        reference: `Refund for ${invoice.invoiceNumber}`,
      });
    } catch (error) {
      // A concurrent duplicate (or a Stripe retry after a crash between the
      // insert and markProcessed) already recorded this exact refund: the
      // UNIQUE constraint on idempotencyKey converts the race into a no-op.
      // Any other DB error keeps the existing semantics (propagate → 500 →
      // Stripe retry) — only the refund-key conflict is swallowed.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.log(
          `Duplicate refund ${idempotencyKey} already recorded — skipping`,
        );
        return;
      }
      throw error;
    }
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
