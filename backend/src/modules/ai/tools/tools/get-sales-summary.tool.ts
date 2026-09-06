import { Injectable } from '@nestjs/common';
import { AITool } from '../tool.interface';
import { SecurityContext } from '../../security/security-context';
import { ReportsService } from '../../../reports/services/reports.service';

/**
 * get_sales_summary — returns sales report with revenue, profit, margin, payment breakdown.
 *
 * Wraps: ReportsService.getSalesReport()
 * Permission: reports:read
 */
@Injectable()
export class GetSalesSummaryTool implements AITool {
  readonly name = 'get_sales_summary';
  readonly description =
    'Get sales report for a period: total revenue, profit, margin, average receipt, products sold, payment breakdown (cash/card/QR). Use for questions about sales performance.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      dateFrom: {
        type: 'string',
        description: 'Start date (ISO 8601, e.g. 2026-09-01)',
      },
      dateTo: {
        type: 'string',
        description: 'End date (ISO 8601, e.g. 2026-09-06)',
      },
      currency: {
        type: 'string',
        description: 'Currency code (e.g. KZT, USD). Defaults to company base currency.',
      },
      page: {
        type: 'number',
        description: 'Page number (default 1)',
      },
      limit: {
        type: 'number',
        description: 'Items per page (default 20, max 100)',
      },
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
    if (input.page) query.page = input.page;
    if (input.limit) query.limit = Math.min(Number(input.limit) || 20, 100);
    return this.reportsService.getSalesReport(ctx.companyId, query);
  }
}
