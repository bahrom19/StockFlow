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
import { SaleStatus } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { SaleQueryDto } from '../dto/sale-query.dto';
import { SaleEntity } from '../entities/sale.entity';
import { SalesService } from '../services/sales.service';

@ApiTags('sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('sales:create')
  @ApiOperation({ summary: 'Create a sale (DRAFT)' })
  @ApiBody({ type: CreateSaleDto })
  @ApiResponse({ status: 201, description: 'Sale created', type: SaleEntity })
  async create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SaleEntity> {
    return this.salesService.create(dto, user.userId, user.companyId);
  }

  @Get()
  @RequirePermission('sales:read')
  @ApiOperation({ summary: 'List sales with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Sales retrieved' })
  async findAll(
    @Query() query: SaleQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    items: SaleEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.salesService.findAll(query, user.companyId);
  }

  @Get('next-number')
  @RequirePermission('sales:create')
  @ApiOperation({ summary: 'Get the next auto-generated sale number' })
  async getNextNumber(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ saleNumber: string }> {
    return this.salesService.getNextSaleNumber(user.companyId);
  }

  @Get('receipt/:id')
  @RequirePermission('sales:read')
  @ApiOperation({ summary: 'Get sale receipt' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Receipt data', type: SaleEntity })
  async getReceipt(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SaleEntity> {
    return this.salesService.getReceipt(id, user.companyId);
  }

  @Get(':id')
  @RequirePermission('sales:read')
  @ApiOperation({ summary: 'Get sale by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Sale retrieved', type: SaleEntity })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SaleEntity> {
    return this.salesService.findById(id, user.companyId);
  }

  @Patch(':id')
  @RequirePermission('sales:update')
  @ApiOperation({ summary: 'Update a draft sale (notes, customer, currency)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: { type: 'string', nullable: true },
        customerId: { type: 'string', nullable: true },
        currency: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Sale updated', type: SaleEntity })
  async update(
    @Param('id') id: string,
    @Body() body: { customerId?: string; notes?: string; currency?: string },
    @CurrentUser() user: JwtPayload,
  ): Promise<SaleEntity> {
    return this.salesService.update(id, body, user.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('sales:cancel')
  @ApiOperation({ summary: 'Delete a draft sale' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.salesService.softDelete(id, user.companyId);
  }

  @Patch(':id/status')
  @RequirePermission('sales:update')
  @ApiOperation({ summary: 'Transition sale status' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(SaleStatus),
          description: 'Target status to transition to',
        },
      },
      required: ['status'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Status transitioned',
    type: SaleEntity,
  })
  async transitionStatus(
    @Param('id') id: string,
    @Body('status') status: SaleStatus,
    @CurrentUser() user: JwtPayload,
  ): Promise<SaleEntity> {
    return this.salesService.transitionStatus(
      id,
      status,
      user.userId,
      user.companyId,
    );
  }

  @Post(':id/complete')
  @RequirePermission('sales:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a sale (decrease inventory, create receipt)',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Sale completed', type: SaleEntity })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SaleEntity> {
    return this.salesService.transitionStatus(
      id,
      SaleStatus.COMPLETED,
      user.userId,
      user.companyId,
    );
  }

  @Post(':id/cancel')
  @RequirePermission('sales:cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending sale' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Sale cancelled', type: SaleEntity })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SaleEntity> {
    return this.salesService.transitionStatus(
      id,
      SaleStatus.CANCELLED,
      user.userId,
      user.companyId,
    );
  }

  @Post(':id/refund')
  @RequirePermission('sales:refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a completed sale (restore inventory)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Sale refunded', type: SaleEntity })
  async refund(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SaleEntity> {
    return this.salesService.transitionStatus(
      id,
      SaleStatus.REFUNDED,
      user.userId,
      user.companyId,
    );
  }
}
