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
import { CreateInventoryCountDto, CompleteInventoryCountDto } from '../dto';
import { InventoryCountEntity } from '../entities';
import { InventoryCountService } from '../services/inventory-count.service';

@ApiTags('Inventory - Counts')
@ApiBearerAuth()
@Controller('inventory/counts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryCountController {
  constructor(private readonly inventoryCountService: InventoryCountService) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get all inventory counts' })
  @ApiOkResponse({ type: [InventoryCountEntity] })
  async findAll(
    @CurrentUser() user: JwtPayload,
  ): Promise<InventoryCountEntity[]> {
    return this.inventoryCountService.findAll(user.companyId);
  }

  @Get(':id')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get inventory count by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: InventoryCountEntity })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<InventoryCountEntity> {
    return this.inventoryCountService.findById(id, user.companyId);
  }

  @Post()
  @RequirePermission('inventory:create')
  @ApiOperation({ summary: 'Create a new inventory count' })
  @ApiBody({ type: CreateInventoryCountDto })
  @ApiOkResponse({ type: InventoryCountEntity })
  async create(
    @Body() dto: CreateInventoryCountDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<InventoryCountEntity> {
    return this.inventoryCountService.create(dto, user.companyId, user.userId);
  }

  @Post(':id/complete')
  @RequirePermission('inventory:update')
  @ApiOperation({
    summary: 'Complete an inventory count and apply adjustments',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: CompleteInventoryCountDto })
  @ApiOkResponse({ type: InventoryCountEntity })
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteInventoryCountDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<InventoryCountEntity> {
    return this.inventoryCountService.complete(
      id,
      dto,
      user.companyId,
      user.userId,
    );
  }
}
