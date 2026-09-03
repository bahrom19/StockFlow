import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { SupplierPaymentsService } from '../services/supplier-payments.service';
import { CreateSupplierPaymentDto } from '../dto/create-supplier-payment.dto';
import { UpdateSupplierPaymentDto } from '../dto/update-supplier-payment.dto';
import { SupplierPaymentEntity } from '../entities/supplier-payment.entity';
import { SupplierFinanceSummaryEntity } from '../entities/supplier-finance-summary.entity';

@ApiTags('suppliers / payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers/:supplierId')
export class SupplierPaymentsController {
  constructor(private readonly paymentsService: SupplierPaymentsService) {}

  // ─────────────────────────────────────────────
  // FINANCE SUMMARY
  // ─────────────────────────────────────────────

  @Get('finance/summary')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier finance summary' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiResponse({ status: 200, type: SupplierFinanceSummaryEntity })
  async getFinanceSummary(
    @Param('supplierId') supplierId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentsService.getFinanceSummary(
      supplierId,
      user.companyId,
    );
  }

  // ─────────────────────────────────────────────
  // LIST PAYMENTS
  // ─────────────────────────────────────────────

  @Get('payments')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'List supplier payments' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200 })
  async findAll(
    @Param('supplierId') supplierId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.paymentsService.findAll(
      supplierId,
      user!.companyId,
      page ?? 1,
      limit ?? 20,
    );
  }

  // ─────────────────────────────────────────────
  // GET PAYMENT BY ID
  // ─────────────────────────────────────────────

  @Get('payments/:paymentId')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier payment by id' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiParam({ name: 'paymentId', type: String })
  @ApiResponse({ status: 200, type: SupplierPaymentEntity })
  async findById(
    @Param('supplierId') supplierId: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentsService.findById(
      paymentId,
      supplierId,
      user.companyId,
    );
  }

  // ─────────────────────────────────────────────
  // CREATE PAYMENT
  // ─────────────────────────────────────────────

  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Record a supplier payment' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiResponse({ status: 201, type: SupplierPaymentEntity })
  async create(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentsService.create(
      supplierId,
      dto,
      user.userId,
      user.companyId,
    );
  }

  // ─────────────────────────────────────────────
  // PATCH (notes/reference only)
  // ─────────────────────────────────────────────

  @Patch('payments/:paymentId')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Update payment notes/reference' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiParam({ name: 'paymentId', type: String })
  @ApiResponse({ status: 200, type: SupplierPaymentEntity })
  async patch(
    @Param('supplierId') supplierId: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: UpdateSupplierPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentsService.patch(
      paymentId,
      supplierId,
      user.companyId,
      dto,
    );
  }

  // ─────────────────────────────────────────────
  // VOID (soft delete + reversal journal)
  // ─────────────────────────────────────────────

  @Delete('payments/:paymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Void supplier payment (creates reversal journal)' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiParam({ name: 'paymentId', type: String })
  async void(
    @Param('supplierId') supplierId: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentsService.void(
      paymentId,
      supplierId,
      user.companyId,
      user.userId,
    );
  }
}
