import { Injectable } from '@nestjs/common';
import { AITool } from '../tool.interface';
import { SecurityContext } from '../../security/security-context';
import { ReportsService } from '../../../reports/services/reports.service';

/**
 * get_dashboard — returns today's/yesterday's/month's sales, profit, inventory value.
 *
 * Wraps: ReportsService.getDashboard()
 * Permission: reports:read
 */
@Injectable()
export class GetDashboardTool implements AITool {
  readonly name = 'get_dashboard';
  readonly description =
    'Get business dashboard summary: today/yesterday/month revenue, profit, inventory value, order count, low stock count. Use this for general business overview questions.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      currency: {
        type: 'string',
        description: 'Currency code filter (e.g. KZT, USD, RUB). Defaults to company base currency.',
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
    if (input.currency && typeof input.currency === 'string') {
      query.currency = input.currency;
    }
    return this.reportsService.getDashboard(ctx.companyId, query);
  }
}
