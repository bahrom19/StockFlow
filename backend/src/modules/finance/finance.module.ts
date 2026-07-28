import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma';
import { SharedModule } from '../shared/shared.module';
import { EventBus, EVENT_BUS } from '../../common/events';
import { ChartOfAccountsController } from './controllers/chart-of-accounts.controller';
import { BankAccountsController } from './controllers/bank-accounts.controller';
import { CashAccountsController } from './controllers/cash-accounts.controller';
import { FinancialPeriodsController } from './controllers/financial-periods.controller';
import { FinancialTransactionsController } from './controllers/financial-transactions.controller';
import { JournalEntriesController } from './controllers/journal-entries.controller';
import { GlEngineController } from './controllers/gl-engine.controller';
import { LedgerQueryController } from './controllers/ledger-query.controller';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { BankAccountsService } from './services/bank-accounts.service';
import { CashAccountsService } from './services/cash-accounts.service';
import { FinancialPeriodsService } from './services/financial-periods.service';
import { FinancialTransactionsService } from './services/financial-transactions.service';
import { JournalEntriesService } from './services/journal-entries.service';
import { GlEngineService } from './services/gl-engine.service';
import { LedgerQueryService } from './services/ledger-query.service';
import { PostingValidationService } from './services/posting-validation.service';
import { FiscalYearCloseService } from './services/fiscal-year-close.service';
import { ChartOfAccountsRepository } from './repositories/chart-of-accounts.repository';
import { BankAccountsRepository } from './repositories/bank-accounts.repository';
import { CashAccountsRepository } from './repositories/cash-accounts.repository';
import { FinancialPeriodsRepository } from './repositories/financial-periods.repository';
import { FinancialTransactionsRepository } from './repositories/financial-transactions.repository';
import { JournalEntriesRepository } from './repositories/journal-entries.repository';
import { LedgerRepository } from './repositories/ledger.repository';
import { FinanceIntegrationService } from './services/finance-integration.service';
import { SaleCompletedEventHandler } from './events/sale-completed.handler';
import { SaleRefundedEventHandler } from './events/sale-refunded.handler';

@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [
    ChartOfAccountsController,
    BankAccountsController,
    CashAccountsController,
    FinancialPeriodsController,
    FinancialTransactionsController,
    JournalEntriesController,
    GlEngineController,
    LedgerQueryController,
  ],
  providers: [
    // Core services
    ChartOfAccountsService,
    BankAccountsService,
    CashAccountsService,
    FinancialPeriodsService,
    FinancialTransactionsService,
    JournalEntriesService,
    FinanceIntegrationService,
    // GL Engine services
    GlEngineService,
    LedgerQueryService,
    PostingValidationService,
    FiscalYearCloseService,
    // Repositories
    ChartOfAccountsRepository,
    BankAccountsRepository,
    CashAccountsRepository,
    FinancialPeriodsRepository,
    FinancialTransactionsRepository,
    JournalEntriesRepository,
    LedgerRepository,
    // Event handlers
    SaleCompletedEventHandler,
    SaleRefundedEventHandler,
  ],
  exports: [
    ChartOfAccountsService,
    BankAccountsService,
    CashAccountsService,
    FinancialPeriodsService,
    FinancialTransactionsService,
    JournalEntriesService,
    FinanceIntegrationService,
    GlEngineService,
    LedgerQueryService,
    PostingValidationService,
    FiscalYearCloseService,
  ],
})
export class FinanceModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly saleCompletedHandler: SaleCompletedEventHandler,
    private readonly saleRefundedHandler: SaleRefundedEventHandler,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('sale.completed', this.saleCompletedHandler);
    this.eventBus.subscribe('sale.refunded', this.saleRefundedHandler);
  }
}
