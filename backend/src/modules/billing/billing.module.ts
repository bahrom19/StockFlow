import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventBus, EVENT_BUS } from '../../common/events';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { SubscriptionPlanController } from './controllers/subscription-plan.controller';
import { CompanySubscriptionController } from './controllers/company-subscription.controller';
import { InvoiceController } from './controllers/invoice.controller';
import { StripeWebhookController } from './webhooks/stripe-webhook.controller';
import { SubscriptionPlanRepository } from './repositories/subscription-plan.repository';
import { CompanySubscriptionRepository } from './repositories/company-subscription.repository';
import { InvoiceRepository } from './repositories/invoice.repository';
import { PaymentTransactionRepository } from './repositories/payment-transaction.repository';
import { UsageRecordRepository } from './repositories/usage-record.repository';
import { SubscriptionPlanService } from './services/subscription-plan.service';
import { CompanySubscriptionService } from './services/company-subscription.service';
import { InvoiceService } from './services/invoice.service';
import { UsageTrackingService } from './services/usage-tracking.service';
import { BillingAuditLoggerHandler } from './events/billing-audit-logger.handler';
import { StripeProvider } from './providers/stripe.provider';
import { PaymentProvider } from './providers/payment-provider.interface';
import { WebhookEngineService } from './webhooks/webhook-engine.service';
import { BillingCronService } from './scheduler/billing-cron.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    SubscriptionPlanController,
    CompanySubscriptionController,
    InvoiceController,
    StripeWebhookController,
  ],
  providers: [
    // Repositories
    SubscriptionPlanRepository,
    CompanySubscriptionRepository,
    InvoiceRepository,
    PaymentTransactionRepository,
    UsageRecordRepository,

    // Services
    SubscriptionPlanService,
    CompanySubscriptionService,
    InvoiceService,
    UsageTrackingService,

    // Payment Providers
    {
      provide: 'PAYMENT_PROVIDER',
      useClass: StripeProvider,
    },
    StripeProvider,

    // Webhook Engine
    WebhookEngineService,

    // Cron Jobs
    BillingCronService,

    // Event Handlers
    BillingAuditLoggerHandler,
  ],
  exports: [
    CompanySubscriptionService,
    SubscriptionPlanService,
    InvoiceService,
    UsageTrackingService,
    StripeProvider,
    WebhookEngineService,
    { provide: 'PAYMENT_PROVIDER', useExisting: StripeProvider },
  ],
})
export class BillingModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly billingAuditLogger: BillingAuditLoggerHandler,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(
      'billing.subscription.created',
      this.billingAuditLogger,
    );
    this.eventBus.subscribe(
      'billing.subscription.changed',
      this.billingAuditLogger,
    );
    this.eventBus.subscribe(
      'billing.subscription.cancelled',
      this.billingAuditLogger,
    );
    this.eventBus.subscribe(
      'billing.subscription.expired',
      this.billingAuditLogger,
    );
    this.eventBus.subscribe(
      'billing.payment.succeeded',
      this.billingAuditLogger,
    );
    this.eventBus.subscribe('billing.payment.failed', this.billingAuditLogger);
    this.eventBus.subscribe(
      'billing.invoice.generated',
      this.billingAuditLogger,
    );
  }
}
