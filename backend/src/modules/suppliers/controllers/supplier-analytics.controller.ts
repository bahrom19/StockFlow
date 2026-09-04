import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SupplierAnalyticsService } from '../services/supplier-analytics.service';
import { SupplierPurchaseSummaryEntity } from '../entities/supplier-purchase-summary.entity';

@ApiTags('suppliers / analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers/:supplierId')
export class SupplierAnalyticsController {
  constructor(private readonly analyticsService: SupplierAnalyticsService) {}

  @Get('analytics/purchase-summary')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier purchase analytics summary' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'ISO date (default: 12 months ago)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'ISO date (default: today)' })
  @ApiResponse({ status: 200, type: SupplierPurchaseSummaryEntity })
  async getPurchaseSummary(
    @Param('supplierId') supplierId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.analyticsService.getPurchaseSummary(
      supplierId,
      user!.companyId,
      dateFrom,
      dateTo,
    );
  }
}
