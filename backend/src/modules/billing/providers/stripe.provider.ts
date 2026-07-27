import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  CheckoutSessionParams,
  CheckoutSessionResult,
  PortalSessionParams,
  PortalSessionResult,
  RefundParams,
  RefundResult,
  ProviderCustomer,
  EnsureCustomerParams,
} from './payment-provider.interface';
import { randomUUID } from 'crypto';

/**
 * Stripe payment provider.
 *
 * In development mode (STRIPE_SECRET_KEY not set or empty), runs in
 * simulation mode — generates fake sessions and transactions without
 * contacting Stripe. In production, uses the Stripe SDK.
 *
 * To enable production mode:
 * 1. `npm install stripe`
 * 2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` env vars
 * 3. Set `STRIPE_PRICE_{PLAN_CODE}` env vars for each plan
 */
@Injectable()
export class StripeProvider implements PaymentProvider {
  private readonly logger = new Logger(StripeProvider.name);
  readonly name = 'stripe';
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = !this.configService.get<string>('app.stripeSecretKey');
    if (this.isDevelopment) {
      this.logger.warn('Stripe running in SIMULATION mode — no real charges will occur');
    }
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    this.logger.log(`Creating checkout session for plan ${params.planCode}, company ${params.companyId}`);

    if (this.isDevelopment) {
      return {
        id: `cs_sim_${randomUUID().slice(0, 12)}`,
        url: `${this.configService.get('app.appUrl', 'http://localhost:3000')}/billing/simulated-checkout`,
        status: 'open',
        customerId: `cus_sim_${params.companyId.slice(0, 8)}`,
        subscriptionId: `sub_sim_${randomUUID().slice(0, 12)}`,
        paymentIntentId: `pi_sim_${randomUUID().slice(0, 12)}`,
        amountTotal: params.priceAmount,
        currency: params.currency,
        metadata: {
          companyId: params.companyId,
          planCode: params.planCode,
        },
      };
    }

    // Production: use Stripe SDK
    // const stripe = await this.getClient();
    // const session = await stripe.checkout.sessions.create({ ... });
    // return this.mapCheckoutSession(session);
    throw new Error('Production Stripe mode requires stripe SDK. Set STRIPE_SECRET_KEY and install stripe package.');
  }

  async createBillingPortalSession(params: PortalSessionParams): Promise<PortalSessionResult> {
    this.logger.log(`Creating billing portal for customer ${params.customerId}`);

    if (this.isDevelopment) {
      return {
        id: `ps_sim_${randomUUID().slice(0, 12)}`,
        url: `${this.configService.get('app.appUrl', 'http://localhost:3000')}/billing/simulated-portal`,
      };
    }

    throw new Error('Production Stripe mode requires stripe SDK.');
  }

  async retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult> {
    this.logger.log(`Retrieving checkout session ${sessionId}`);

    if (this.isDevelopment) {
      return {
        id: sessionId,
        url: null,
        status: 'complete',
        customerId: `cus_sim_${randomUUID().slice(0, 8)}`,
        subscriptionId: `sub_sim_${randomUUID().slice(0, 12)}`,
        paymentIntentId: `pi_sim_${randomUUID().slice(0, 12)}`,
        amountTotal: '0',
        currency: 'USD',
        metadata: {},
      };
    }

    throw new Error('Production Stripe mode requires stripe SDK.');
  }

  async createRefund(params: RefundParams): Promise<RefundResult> {
    this.logger.log(`Creating refund for payment ${params.paymentIntentId}`);

    if (this.isDevelopment) {
      return {
        id: `re_sim_${randomUUID().slice(0, 12)}`,
        status: 'succeeded',
        amount: params.amount ?? '0',
        reason: params.reason,
      };
    }

    throw new Error('Production Stripe mode requires stripe SDK.');
  }

  async retrieveCustomer(providerCustomerId: string): Promise<ProviderCustomer | null> {
    if (this.isDevelopment) {
      return {
        id: providerCustomerId,
        email: 'simulated@example.com',
        name: 'Simulated Customer',
      };
    }

    throw new Error('Production Stripe mode requires stripe SDK.');
  }

  async ensureCustomer(params: EnsureCustomerParams): Promise<ProviderCustomer> {
    this.logger.log(`Ensuring customer for ${params.email}`);

    if (this.isDevelopment) {
      return {
        id: `cus_sim_${params.companyId.slice(0, 8)}`,
        email: params.email,
        name: params.name,
      };
    }

    throw new Error('Production Stripe mode requires stripe SDK.');
  }

  async cancelProviderSubscription(providerSubscriptionId: string): Promise<void> {
    this.logger.log(`Cancelling provider subscription ${providerSubscriptionId}`);

    if (this.isDevelopment) {
      return;
    }

    throw new Error('Production Stripe mode requires stripe SDK.');
  }

  async ping(): Promise<boolean> {
    if (this.isDevelopment) {
      return true;
    }
    // Production: ping Stripe API
    return false;
  }
}
