import { Injectable } from '@nestjs/common';
import { AITool } from '../tool.interface';
import { SecurityContext } from '../../security/security-context';
import { ReportsService } from '../../../reports/services/reports.service';

@Injectable()
export class GetTopProductsTool implements AITool {
  readonly name = 'get_top_products';
  readonly description =
    'Get best-selling products by revenue: product name, quantity sold, revenue, profit, margin. Use for questions about popular products, what sells best.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      dateFrom: { type: 'string', description: 'Start date (ISO 8601)' },
      dateTo: { type: 'string', description: 'End date (ISO 8601)' },
      currency: { type: 'string', description: 'Currency code' },
      top: { type: 'number', description: 'Top N results (default 10, max 50)' },
    },
  };
  readonly requiredPermission = 'reports:read';

  constructor(private readonly reportsService: ReportsService) {}

  async execute(
    input: Record<string, unknown>,
    ctx: SecurityContext,
  ): Promise<Record<string, unknown>> {
    const query: any = {};
    if (input.dateFrom) query.dateFrom = input.dateFrom;
    if (input.dateTo) query.dateTo = input.dateTo;
    if (input.currency) query.currency = input.currency;
    if (input.top) query.top = Math.min(Number(input.top) || 10, 50);
    return this.reportsService.getTopProducts(ctx.companyId, query);
  }
}
