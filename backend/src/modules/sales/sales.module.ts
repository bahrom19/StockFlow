import { Module } from '@nestjs/common';
import { CashShiftController } from './controllers/cash-shift.controller';
import { SalesController } from './controllers/sales.controller';
import { CashShiftRepository } from './repositories/cash-shift.repository';
import { SalesRepository } from './repositories/sales.repository';
import { CashShiftService } from './services/cash-shift.service';
import { SalesService } from './services/sales.service';

@Module({
  imports: [],
  controllers: [SalesController, CashShiftController],
  providers: [
    SalesRepository,
    CashShiftRepository,
    SalesService,
    CashShiftService,
  ],
})
export class SalesModule {}
