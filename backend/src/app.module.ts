import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './common/config/config.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ObservabilityModule } from './common/observability/observability.module';
import { MetricsInterceptor } from './common/observability/metrics.interceptor';
import { PrismaModule } from './common/prisma';
import { CacheModule } from './infrastructure/cache/cache.module';
import { EventBusModule } from './common/events';
import { HealthModule } from './modules/health/health.module';
import { SharedModule } from './modules/shared/shared.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { SalesModule } from './modules/sales/sales.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FinanceModule } from './modules/finance/finance.module';
import { CrmModule } from './modules/crm/crm.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    SharedModule,
    ObservabilityModule,
    CacheModule,
    EventBusModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    SuppliersModule,
    RbacModule,
    PurchasingModule,
    SalesModule,
    ReportsModule,
    FinanceModule,
    CrmModule,
    BillingModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
