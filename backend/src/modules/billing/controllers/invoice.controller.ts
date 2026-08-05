import {
  Body,
  Controller,
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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { InvoiceService } from '../services/invoice.service';
import { InvoiceQueryDto } from '../dto/invoice-query.dto';
import { InvoiceEntity } from '../entities/invoice.entity';

@ApiTags('billing / invoices')
@ApiBearerAuth()
@Controller('billing/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @RequirePermission('billing:read')
  @ApiOperation({ summary: 'List company invoices' })
  @ApiResponse({ status: 200, description: 'Invoices retrieved' })
  async findAll(
    @Query() query: InvoiceQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    items: InvoiceEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.invoiceService.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('billing:read')
  @ApiOperation({ summary: 'Get invoice by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Invoice retrieved',
    type: InvoiceEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<InvoiceEntity> {
    return this.invoiceService.findById(id, user.companyId);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('billing:create')
  @ApiOperation({ summary: 'Mark invoice as paid (manual override)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        paidAmount: { type: 'string', example: '29.0000' },
        providerInvoiceId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice marked as paid',
    type: InvoiceEntity,
  })
  async markPaid(
    @Param('id') id: string,
    @Body('paidAmount') paidAmount: string,
    @Body('providerInvoiceId') providerInvoiceId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<InvoiceEntity> {
    return this.invoiceService.markPaid(
      id,
      user.companyId,
      paidAmount,
      providerInvoiceId,
    );
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('admin:billing')
  @ApiOperation({ summary: 'Void a pending invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice voided',
    type: InvoiceEntity,
  })
  async voidInvoice(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<InvoiceEntity> {
    return this.invoiceService.voidInvoice(id, user.companyId);
  }
}
