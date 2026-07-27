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
import { PurchaseOrderStatus } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { PurchaseOrderQueryDto } from '../dto/purchase-order-query.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { PurchaseOrderEntity } from '../entities/purchase-order.entity';
import { PurchaseOrderService } from '../services/purchase-order.service';

@ApiTags('purchasing / purchase-orders')
@Controller('purchasing/purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrderController {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing:create')
  @ApiOperation({ summary: 'Create a purchase order' })
  @ApiBody({ type: CreatePurchaseOrderDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Purchase order created',
    type: PurchaseOrderEntity,
  })
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PurchaseOrderEntity> {
    return this.purchaseOrderService.create(
      dto,
      currentUser.userId,
      currentUser.companyId,
    );
  }

  @Get()
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'List purchase orders with pagination and filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase orders retrieved',
  })
  async findAll(
    @Query() query: PurchaseOrderQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{
    items: PurchaseOrderEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.purchaseOrderService.findAll(query, currentUser.companyId);
  }

  @Get(':id')
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'Get a purchase order by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order retrieved',
    type: PurchaseOrderEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PurchaseOrderEntity> {
    return this.purchaseOrderService.findById(id, currentUser.companyId);
  }

  @Patch(':id')
  @RequirePermission('purchasing:update')
  @ApiOperation({ summary: 'Update a draft purchase order' })
  @ApiBody({ type: UpdatePurchaseOrderDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase order updated',
    type: PurchaseOrderEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PurchaseOrderEntity> {
    return this.purchaseOrderService.update(
      id,
      dto,
      currentUser.userId,
      currentUser.companyId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('purchasing:delete')
  @ApiOperation({ summary: 'Soft delete a draft purchase order' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Purchase order deleted',
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    return this.purchaseOrderService.softDelete(id, currentUser.companyId);
  }

  @Patch(':id/status')
  @RequirePermission('purchasing:update')
  @ApiOperation({ summary: 'Transition purchase order status' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiQuery({ name: 'status', enum: PurchaseOrderStatus, required: true })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status transitioned',
    type: PurchaseOrderEntity,
  })
  async transitionStatus(
    @Param('id') id: string,
    @Query('status') status: PurchaseOrderStatus,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PurchaseOrderEntity> {
    return this.purchaseOrderService.transitionStatus(
      id,
      status,
      currentUser.userId,
      currentUser.companyId,
    );
  }

  @Get('next-number')
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'Get the next auto-generated order number' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Next order number' })
  async getNextOrderNumber(
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ orderNumber: string }> {
    const orderNumber = await this.purchaseOrderService.getNextOrderNumber(
      currentUser.companyId,
    );
    return { orderNumber };
  }
}
