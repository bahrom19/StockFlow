import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { CreateWarehouseDto, UpdateWarehouseDto } from '../dto';
import { WarehouseEntity } from '../entities';
import { WarehouseService } from '../services/warehouse.service';

@ApiTags('Inventory - Warehouses')
@ApiBearerAuth()
@Controller('inventory/warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get all warehouses' })
  @ApiOkResponse({ type: [WarehouseEntity] })
  async findAll(@CurrentUser() user: JwtPayload): Promise<WarehouseEntity[]> {
    return this.warehouseService.findAll(user.companyId);
  }

  @Get(':id')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get warehouse by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: WarehouseEntity })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WarehouseEntity> {
    return this.warehouseService.findById(id, user.companyId);
  }

  @Post()
  @RequirePermission('inventory:create')
  @ApiOperation({ summary: 'Create a new warehouse' })
  @ApiBody({ type: CreateWarehouseDto })
  @ApiOkResponse({ type: WarehouseEntity })
  async create(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WarehouseEntity> {
    return this.warehouseService.create(dto, user.companyId, user.userId);
  }

  @Patch(':id')
  @RequirePermission('inventory:update')
  @ApiOperation({ summary: 'Update a warehouse' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateWarehouseDto })
  @ApiOkResponse({ type: WarehouseEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WarehouseEntity> {
    return this.warehouseService.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('inventory:delete')
  @ApiOperation({ summary: 'Soft delete a warehouse' })
  @ApiParam({ name: 'id', type: 'string' })
  async delete(
    @Param('id') id: string,
    @Body('rowVersion') rowVersion: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.warehouseService.softDelete(
      id,
      user.companyId,
      rowVersion,
      user.userId,
    );
  }
}
