import { Injectable } from '@nestjs/common';
import { AITool } from '../tool.interface';
import { SecurityContext } from '../../security/security-context';
import { ReportsService } from '../../../reports/services/reports.service';

@Injectable()
export class GetProfitTool implements AITool {
  readonly name = 'get_profit';
  readonly description =
    'Get profit report with revenue, cost, profit, margin broken down by daily/weekly/monthly periods. Use for questions about profitability, margin trends.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      dateFrom: { type: 'string', description: 'Start date (ISO 8601)' },
      dateTo: { type: 'string', description: 'End date (ISO 8601)' },
      currency: { type: 'string', description: 'Currency code' },
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
    return this.reportsService.getProfitReport(ctx.companyId, query);
  }
}
