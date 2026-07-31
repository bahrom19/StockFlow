import { Module } from '@nestjs/common';
import { CashShiftController } from './controllers/cash-shift.controller';
import { SalesController } from './controllers/sales.controller';
import { CashShiftRepository } from './repositories/cash-shift.repository';
import { SalesRepository } from './repositories/sales.repository';
import { CashShiftService } from './services/cash-shift.service';
import { SalesService } from './services/sales.service';

@Module({
  imports: [],
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
})
export class SalesModule {}
