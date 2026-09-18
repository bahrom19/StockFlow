import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
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
import { CustomerCreditLedgerService } from '../services/customer-credit-ledger.service';
import {
  CustomerCreditBalanceEntity,
  CustomerCreditTransactionEntity,
} from '../entities/customer-credit-transaction.entity';
import {
  CreateCreditAdjustmentDto,
  CustomerCreditTransactionQueryDto,
} from '../dto/customer-credit.dto';

/**
 * G11-F2 — customer credit ledger read/adjust API.
 *
 * Spend (sale completion) and refund-credit issuance are domain-integrated
 * inside the originating transactions and are deliberately NOT exposed as
 * endpoints. companyId always comes from the authenticated context —
 * never from the client.
 */
@ApiTags('crm / customer-credit')
@Controller('crm/customers/:customerId/credit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerCreditController {
  constructor(private readonly ledgerService: CustomerCreditLedgerService) {}

  @Get()
  @RequirePermission('crm:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Customer credit balance(s)' })
  @ApiParam({ name: 'customerId', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: [CustomerCreditBalanceEntity] })
  async getBalance(
    @Param('customerId') customerId: string,
    @Query('currency') currency: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerCreditBalanceEntity[]> {
    return this.ledgerService.getBalances(
      customerId,
      user.companyId,
      currency,
    );
  }

  @Get('transactions')
  @RequirePermission('crm:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Customer credit transaction history' })
  @ApiParam({ name: 'customerId', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK })
  async getTransactions(
    @Param('customerId') customerId: string,
    @Query() query: CustomerCreditTransactionQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    items: CustomerCreditTransactionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.ledgerService.getTransactions(
      customerId,
      user.companyId,
      query,
    );
  }

  @Post('adjustments')
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Manual credit adjustment (positive → ISSUED top-up, negative → ADJUSTED write-off)',
  })
  @ApiParam({ name: 'customerId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: CustomerCreditTransactionEntity,
  })
  async adjust(
    @Param('customerId') customerId: string,
    @Body() dto: CreateCreditAdjustmentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerCreditTransactionEntity> {
    return this.ledgerService.adjust(
      dto,
      customerId,
      user.companyId,
      user.userId,
    );
  }
}
