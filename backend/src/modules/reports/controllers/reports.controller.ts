import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { ReportQueryDto } from '../dto/report-query.dto';
import { ReportsService } from '../services/reports.service';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermission('reports:read')
  @ApiOperation({
    summary:
      'Dashboard summary — today/yesterday/month sales, inventory value, counts',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    return this.reportsService.getDashboard(user.companyId);
  }

  @Get('sales')
  @RequirePermission('reports:read')
  @ApiOperation({
    summary: 'Sales report with revenue, profit, margin, payment breakdown',
  })
  @ApiResponse({ status: 200, description: 'Sales report data' })
  async getSalesReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getSalesReport(user.companyId, query);
  }

  @Get('products/top')
  @RequirePermission('reports:read')
  @ApiOperation({ summary: 'Top selling products by revenue' })
  @ApiQuery({
    name: 'top',
    required: false,
    description: 'Top N results (default 10)',
  })
  @ApiResponse({ status: 200, description: 'Top products' })
  async getTopProducts(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getTopProducts(user.companyId, query);
  }

  @Get('inventory/low-stock')
  @RequirePermission('reports:read')
  @ApiOperation({ summary: 'Low stock and out of stock products' })
  @ApiResponse({ status: 200, description: 'Low stock items' })
  async getLowStock(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getLowStock(user.companyId, query);
  }

  @Get('inventory/value')
  @RequirePermission('reports:read')
  @ApiOperation({ summary: 'Inventory valuation — quantity × average cost' })
  @ApiResponse({ status: 200, description: 'Inventory valuation' })
  async getInventoryValuation(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getInventoryValuation(user.companyId, query);
  }

  @Get('customers')
  @RequirePermission('reports:read')
  @ApiOperation({
    summary:
      'Customer report — orders, revenue, average receipt, last purchase',
  })
  @ApiResponse({ status: 200, description: 'Customer report' })
  async getCustomerReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getCustomerReport(user.companyId, query);
  }

  @Get('suppliers')
  @RequirePermission('reports:read')
  @ApiOperation({
    summary: 'Supplier report — purchase orders, totals, last purchase',
  })
  @ApiResponse({ status: 200, description: 'Supplier report' })
  async getSupplierReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getSupplierReport(user.companyId, query);
  }

  @Get('purchasing')
  @RequirePermission('reports:read')
  @ApiOperation({
    summary: 'Purchasing report — orders, received, pending, cancelled, value',
  })
  @ApiResponse({ status: 200, description: 'Purchasing report' })
  async getPurchasingReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getPurchasingReport(user.companyId, query);
  }

  @Get('cash-shifts')
  @RequirePermission('reports:read')
  @ApiOperation({
    summary: 'Cash shift report — open/closed shifts, totals, differences',
  })
  @ApiResponse({ status: 200, description: 'Cash shift report' })
  async getCashShiftReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getCashShiftReport(user.companyId, query);
  }

  @Get('profit')
  @RequirePermission('reports:read')
  @ApiOperation({
    summary:
      'Profit report — revenue, cost, gross profit, margin (daily/weekly/monthly)',
  })
  @ApiResponse({ status: 200, description: 'Profit report' })
  async getProfitReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportsService.getProfitReport(user.companyId, query);
  }
}
