import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
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
import { SupplierPaymentAllocationsService } from '../services/supplier-payment-allocations.service';
import { CreateSupplierPaymentAllocationDto } from '../dto/create-supplier-payment-allocation.dto';
import { SupplierPaymentAllocationEntity } from '../entities/supplier-payment-allocation.entity';

@ApiTags('suppliers / payment allocations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers/:supplierId/payment-allocations')
export class SupplierPaymentAllocationsController {
  constructor(private readonly allocationsService: SupplierPaymentAllocationsService) {}

  // ─────────────────────────────────────────────
  // CREATE ALLOCATION
  // ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Create a payment allocation' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiResponse({ status: 201, type: SupplierPaymentAllocationEntity })
  async create(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierPaymentAllocationDto,
    @CurrentUser() user: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.allocationsService.create(
      supplierId,
      user.companyId,
      dto.paymentId,
      dto.purchaseInvoiceId!,
      dto.amount,
      user.userId,
      idempotencyKey,
    );
  }

  // ─────────────────────────────────────────────
  // LIST ALLOCATIONS BY PAYMENT
  // ─────────────────────────────────────────────

  @Get('payment/:paymentId')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get allocations for a payment' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiParam({ name: 'paymentId', type: String })
  @ApiResponse({ status: 200, type: [SupplierPaymentAllocationEntity] })
  async findByPayment(
    @Param('supplierId') supplierId: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.allocationsService.findByPayment(
      paymentId,
      supplierId,
      user.companyId,
    );
  }

  // ─────────────────────────────────────────────
  // LIST ALLOCATIONS BY INVOICE
  // ─────────────────────────────────────────────

  @Get('invoice/:invoiceId')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get allocations for an invoice' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiParam({ name: 'invoiceId', type: String })
  @ApiResponse({ status: 200, type: [SupplierPaymentAllocationEntity] })
  async findByInvoice(
    @Param('supplierId') supplierId: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.allocationsService.findByInvoice(
      invoiceId,
      supplierId,
      user.companyId,
    );
  }
}
