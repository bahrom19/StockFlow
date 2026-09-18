import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { IdempotencyModule } from '../../infrastructure/idempotency/idempotency.module';
import { CompaniesModule } from '../companies/companies.module';
import { CrmModule } from '../crm/crm.module';
import { CashShiftController } from './controllers/cash-shift.controller';
import { SalesController } from './controllers/sales.controller';
import { CashShiftRepository } from './repositories/cash-shift.repository';
import { SalesRepository } from './repositories/sales.repository';
import { CashShiftService } from './services/cash-shift.service';
import { SalesService } from './services/sales.service';

@Module({
  imports: [SharedModule, IdempotencyModule, CompaniesModule, CrmModule],
  // CashShiftController must be registered BEFORE SalesController so that the
  // literal route `sales/cash-shifts` wins over the parameterized `sales/:id`.
  // Otherwise `GET /sales/cash-shifts` binds id="cash-shifts" and sale.findFirst()
  // throws a Prisma UUID error ("Inconsistent column data").
  controllers: [CashShiftController, SalesController],
  providers: [
    SalesRepository,
    CashShiftRepository,
    SalesService,
    CashShiftService,
  ],
  // G11-E E2: consumed by SalesRefundModule. The dependency direction stays
  // SalesRefundModule -> SalesModule (never the reverse), so there is no cycle.
  exports: [SalesRepository, CashShiftRepository],
})
export class SalesModule {}
