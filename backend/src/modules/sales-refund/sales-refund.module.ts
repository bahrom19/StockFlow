import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { SalesModule } from '../sales/sales.module';
import { SalesRefundController } from './controllers/sales-refund.controller';
import { SalesRefundRepository } from './repositories/sales-refund.repository';
import { SalesRefundService } from './services/sales-refund.service';

/**
 * G11-E E2 — SalesRefund module.
 *
 * Dependency direction is ONE-WAY: SalesRefundModule -> { SharedModule, SalesModule }.
 * SalesModule must NEVER import SalesRefundModule (that would be a cycle), so no
 * `forwardRef()` is used anywhere.
 *
 * EVENT_BUS is provided by the @Global() EventBusModule and is therefore not
 * imported here.
 */
@Module({
  imports: [SharedModule, SalesModule],
  controllers: [SalesRefundController],
  providers: [SalesRefundRepository, SalesRefundService],
  exports: [SalesRefundService, SalesRefundRepository],
})
export class SalesRefundModule {}