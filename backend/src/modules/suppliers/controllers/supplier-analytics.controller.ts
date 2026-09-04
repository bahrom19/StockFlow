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
import { SupplierProductPurchaseListEntity } from '../entities/supplier-product-purchase.entity';
import { SupplierReliabilityEntity } from '../entities/supplier-reliability.entity';
import { SupplierPriceHistoryEntity } from '../entities/supplier-price-history.entity';

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

  @Get('analytics/product-purchases')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier product purchase detail' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @ApiResponse({ status: 200, type: SupplierProductPurchaseListEntity })
  async getProductPurchases(
    @Param('supplierId') supplierId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.analyticsService.getProductPurchases(
      supplierId,
      user!.companyId,
      dateFrom,
      dateTo,
      page ?? 1,
      limit ?? 20,
      search,
      sortBy,
      sortOrder as 'asc' | 'desc' | undefined,
    );
  }

  @Get('analytics/reliability')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier delivery reliability metrics' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'ISO date (default: 12 months ago)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'ISO date (default: today)' })
  @ApiResponse({ status: 200, type: SupplierReliabilityEntity })
  async getReliability(
    @Param('supplierId') supplierId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.analyticsService.getReliability(
      supplierId,
      user!.companyId,
      dateFrom,
      dateTo,
    );
  }

  @Get('analytics/price-history')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier product purchase price history' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiQuery({ name: 'productId', required: true, type: String, description: 'Product ID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'ISO date (default: 12 months ago)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'ISO date (default: today)' })
  @ApiResponse({ status: 200, type: SupplierPriceHistoryEntity })
  async getPriceHistory(
    @Param('supplierId') supplierId: string,
    @Query('productId') productId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.analyticsService.getPriceHistory(
      supplierId,
      user!.companyId,
      productId,
      dateFrom,
      dateTo,
    );
  }
}
