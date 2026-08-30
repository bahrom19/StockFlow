import {
  Body,
  Controller,
  Delete,
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
import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';
import { GoodsReceiptQueryDto } from '../dto/goods-receipt-query.dto';
import { GoodsReceiptEntity } from '../entities/goods-receipt.entity';
import { GoodsReceiptService } from '../services/goods-receipt.service';

@ApiTags('purchasing / goods-receipts')
@Controller('purchasing/goods-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoodsReceiptController {
  constructor(private readonly goodsReceiptService: GoodsReceiptService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing:create')
  @ApiOperation({ summary: 'Receive goods against a purchase order' })
  @ApiBody({ type: CreateGoodsReceiptDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Goods receipt created',
    type: GoodsReceiptEntity,
  })
  async create(
    @Body() dto: CreateGoodsReceiptDto,
    @CurrentUser() currentUser: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<GoodsReceiptEntity> {
    return this.goodsReceiptService.create(
      dto,
      currentUser.userId,
      currentUser.companyId,
      idempotencyKey,
    );
  }

  @Get()
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'List goods receipts with pagination and filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Goods receipts retrieved',
  })
  async findAll(
    @Query() query: GoodsReceiptQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{
    items: GoodsReceiptEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.goodsReceiptService.findAll(query, currentUser.companyId);
  }

  @Get(':id')
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'Get a goods receipt by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Goods receipt retrieved',
    type: GoodsReceiptEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<GoodsReceiptEntity> {
    return this.goodsReceiptService.findById(id, currentUser.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('purchasing:delete')
  @ApiOperation({ summary: 'Soft delete a draft goods receipt' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Goods receipt deleted',
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    return this.goodsReceiptService.softDelete(id, currentUser.companyId);
  }
}
