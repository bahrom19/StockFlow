import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SupplierCreditSummaryService } from '../services/supplier-credit-summary.service';
import { SupplierCreditSummaryEntity } from '../entities/supplier-credit-summary.entity';

@ApiTags('suppliers / credit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers/:supplierId')
export class SupplierCreditSummaryController {
  constructor(
    private readonly creditSummaryService: SupplierCreditSummaryService,
  ) {}

  @Get('credit-summary')
  @RequirePermission('suppliers:read')
  @ApiOperation({
    summary:
      'Get supplier credit summary (read-only; company base currency; no enforcement)',
  })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiResponse({ status: 200, type: SupplierCreditSummaryEntity })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async getCreditSummary(
    @Param('supplierId') supplierId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SupplierCreditSummaryEntity> {
    return this.creditSummaryService.getCreditSummary(
      supplierId,
      user.companyId,
    );
  }
}