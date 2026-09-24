import { Module } from '@nestjs/common';
import { ReportsController } from './controllers/reports.controller';
import { ReportsRepository } from './repositories/reports.repository';
import { ReportsService } from './services/reports.service';
// G15-06b scope extension: FinanceModule exposes LedgerQueryService so the
// GL-backed P&L can reuse canonical Finance/GL query infrastructure.
// One-directional: nothing in FinanceModule's subtree imports ReportsModule.
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [ReportsController],
  providers: [ReportsRepository, ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
