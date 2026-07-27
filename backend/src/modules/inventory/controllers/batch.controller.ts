import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CreateBatchDto } from '../dto';
import { BatchEntity } from '../entities';
import { BatchService } from '../services/batch.service';

@ApiTags('Inventory - Batches')
@ApiBearerAuth()
@Controller('inventory/batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Get(':productId')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get batches/lots for a product' })
  @ApiParam({ name: 'productId', type: 'string' })
  @ApiOkResponse({ type: [BatchEntity] })
  async findByProduct(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BatchEntity[]> {
    return this.batchService.findByProduct(productId, user.companyId);
  }

  @Post()
  @RequirePermission('inventory:create')
  @ApiOperation({ summary: 'Create a batch/lot' })
  @ApiBody({ type: CreateBatchDto })
  @ApiOkResponse({ type: BatchEntity })
  async create(
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BatchEntity> {
    return this.batchService.create(dto, user.companyId, user.userId);
  }
}
