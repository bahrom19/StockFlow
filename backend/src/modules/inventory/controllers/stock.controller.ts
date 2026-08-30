import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { AdjustStockDto, TransferStockDto, StockQueryDto } from '../dto';
import { StockEntity, StockMovementEntity } from '../entities';
import { StockService } from '../services/stock.service';

@ApiTags('Inventory - Stock')
@ApiBearerAuth()
@Controller('inventory/stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get all stock levels across warehouses' })
  @ApiOkResponse({ type: [StockEntity] })
  async findAll(
    @Query() query: StockQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ items: StockEntity[]; total: number }> {
    return this.stockService.findAll(user.companyId, query);
  }

  @Get('movements')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get stock movement history' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: [StockMovementEntity] })
  async getMovements(
    @Query('productId') productId: string | undefined,
    @Query('warehouseId') warehouseId: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<StockMovementEntity[]> {
    return this.stockService.getMovements(user.companyId, {
      productId,
      warehouseId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':productId')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get stock for a specific product' })
  @ApiParam({ name: 'productId', type: 'string' })
  @ApiOkResponse({ type: [StockEntity] })
  async findByProduct(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StockEntity[]> {
    return this.stockService.findByProduct(productId, user.companyId);
  }

  @Post('adjust')
  @RequirePermission('inventory:adjust')
  @ApiOperation({
    summary: 'Adjust stock quantity for a product in a warehouse',
  })
  @ApiBody({ type: AdjustStockDto })
  @ApiOkResponse({ type: StockMovementEntity })
  async adjustStock(
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<StockMovementEntity> {
    return this.stockService.adjustStock(
      dto,
      user.companyId,
      user.userId,
      idempotencyKey,
    );
  }

  @Post('transfer')
  @RequirePermission('inventory:transfer')
  @ApiOperation({ summary: 'Transfer stock between warehouses' })
  @ApiBody({ type: TransferStockDto })
  @ApiOkResponse({ type: [StockMovementEntity] })
  async transferStock(
    @Body() dto: TransferStockDto,
    @CurrentUser() user: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<StockMovementEntity[]> {
    return this.stockService.transferStock(
      dto,
      user.companyId,
      user.userId,
      idempotencyKey,
    );
  }
}
