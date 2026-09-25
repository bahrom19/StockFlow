import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { LedgerQueryService } from '../services/ledger-query.service';
import { CashFlowService } from '../services/cash-flow.service';

@ApiTags('finance / ledger')
@Controller('finance/ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerQueryController {
  constructor(
    private readonly ledgerQuery: LedgerQueryService,
    private readonly cashFlow: CashFlowService,
  ) {}

  /**
   * NOTE: literal routes (`balances/account`, `trial-balance`, `balance-sheet`,
   * `cash-flow`) MUST be declared BEFORE the parameterized `:accountId` route. NestJS
   * matches routes in declaration order — otherwise
   * `GET /finance/ledger/trial-balance` binds accountId="trial-balance" and
   * journalLine.findMany() throws a Prisma UUID error
   * ("Inconsistent column data").
   */

  @Get('balances/account')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Get account balance snapshots' })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'financialPeriodId', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiResponse({ status: 200, description: 'Account balance snapshots' })
  async getAccountBalances(
    @Query('accountId') accountId: string | undefined,
    @Query('financialPeriodId') financialPeriodId: string | undefined,
    @Query('year') year: string | undefined,
    @Query('month') month: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerQuery.getAccountBalance({
      companyId: user.companyId,
      accountId,
      financialPeriodId,
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
    });
  }

  @Get('trial-balance')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Generate trial balance' })
  @ApiQuery({
    name: 'asOfDate',
    required: false,
    description: 'Date to calculate balance as of',
  })
  @ApiQuery({
    name: 'accountType',
    required: false,
    enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
  })
  @ApiResponse({ status: 200, description: 'Trial balance rows' })
  async getTrialBalance(
    @Query('asOfDate') asOfDate: string | undefined,
    @Query('accountType') accountType: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerQuery.getTrialBalance({
      companyId: user.companyId,
      asOfDate: asOfDate ? new Date(asOfDate) : undefined,
      accountType,
    });
  }

  @Get('balance-sheet')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Generate GL-based balance sheet' })
  @ApiQuery({
    name: 'asOfDate',
    required: false,
    description: 'Date to calculate balance as of',
  })
  @ApiResponse({ status: 200, description: 'Balance sheet sections' })
  async getBalanceSheet(
    @Query('asOfDate') asOfDate: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerQuery.getBalanceSheet({
      companyId: user.companyId,
      asOfDate: asOfDate ? new Date(asOfDate) : undefined,
    });
  }

  @Get('cash-flow')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Generate GL-based cash flow statement' })
  @ApiQuery({
    name: 'dateFrom',
    required: true,
    description: 'Inclusive start calendar date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: true,
    description: 'Inclusive end calendar date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Cash flow sections' })
  async getCashFlow(
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.cashFlow.getCashFlow({
      companyId: user.companyId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
  }

  @Get(':accountId')
  @RequirePermission('finance:read')
  @ApiOperation({
    summary: 'Get general ledger for an account with running balance',
  })
  @ApiParam({ name: 'accountId' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: 200,
    description: 'Ledger lines with running balance',
  })
  async getLedger(
    @Param('accountId') accountId: string,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ledgerQuery.getLedger({
      companyId: user.companyId,
      accountId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
