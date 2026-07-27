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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PurchaseInvoiceStatus } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CreatePurchaseInvoiceDto } from '../dto/create-purchase-invoice.dto';
import { PurchaseInvoiceQueryDto } from '../dto/purchase-invoice-query.dto';
import { PurchaseInvoiceEntity } from '../entities/purchase-invoice.entity';
import { PurchaseInvoiceService } from '../services/purchase-invoice.service';

@ApiTags('purchasing / invoices')
@Controller('purchasing/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseInvoiceController {
  constructor(private readonly service: PurchaseInvoiceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing:create')
  @ApiOperation({ summary: 'Create a purchase invoice' })
  @ApiBody({ type: CreatePurchaseInvoiceDto })
  @ApiResponse({ status: 201, type: PurchaseInvoiceEntity })
  async create(
    @Body() dto: CreatePurchaseInvoiceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PurchaseInvoiceEntity> {
    return this.service.create(dto, user.userId, user.companyId);
  }

  @Get()
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'List purchase invoices' })
  async findAll(
    @Query() query: PurchaseInvoiceQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'Get purchase invoice by id' })
  @ApiParam({ name: 'id' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PurchaseInvoiceEntity> {
    return this.service.findById(id, user.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('purchasing:delete')
  @ApiOperation({ summary: 'Delete a draft invoice' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.softDelete(id, user.companyId);
  }

  @Patch(':id/status')
  @RequirePermission('purchasing:update')
  @ApiOperation({ summary: 'Transition invoice status' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'status', enum: PurchaseInvoiceStatus })
  async transitionStatus(
    @Param('id') id: string,
    @Query('status') status: PurchaseInvoiceStatus,
    @CurrentUser() user: JwtPayload,
  ): Promise<PurchaseInvoiceEntity> {
    return this.service.transitionStatus(
      id,
      status,
      user.userId,
      user.companyId,
    );
  }
}
