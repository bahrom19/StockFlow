import { Injectable } from '@nestjs/common';
import { AITool } from '../tool.interface';
import { SecurityContext } from '../../security/security-context';
import { ReportsService } from '../../../reports/services/reports.service';

@Injectable()
export class GetLowStockTool implements AITool {
  readonly name = 'get_low_stock';
  readonly description =
    'Get products that are low on stock or out of stock: product name, SKU, current quantity, minimum quantity, warehouse. Use for questions about items needing reorder.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      warehouseId: { type: 'string', description: 'Filter by warehouse ID' },
      page: { type: 'number', description: 'Page number (default 1)' },
      limit: { type: 'number', description: 'Items per page (default 50)' },
    },
  };
  readonly requiredPermission = 'reports:read';

  constructor(private readonly reportsService: ReportsService) {}

  async execute(
    input: Record<string, unknown>,
    ctx: SecurityContext,
  ): Promise<Record<string, unknown>> {
    const query: any = {};
    if (input.warehouseId) query.warehouseId = input.warehouseId;
    if (input.page) query.page = input.page;
    if (input.limit) query.limit = input.limit;
    return this.reportsService.getLowStock(ctx.companyId, query);
  }
}
