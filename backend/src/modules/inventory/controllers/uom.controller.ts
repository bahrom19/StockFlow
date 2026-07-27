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
import {
  UomService,
  CreateUomDto,
  UpdateUomDto,
} from '../services/uom.service';

@ApiTags('Inventory - Units of Measure')
@ApiBearerAuth()
@Controller('inventory/uom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UomController {
  constructor(private readonly uomService: UomService) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get all units of measure' })
  async findAll(@CurrentUser() user: JwtPayload): Promise<any[]> {
    return this.uomService.findAll(user.companyId);
  }

  @Post()
  @RequirePermission('inventory:create')
  @ApiOperation({ summary: 'Create a unit of measure' })
  async create(
    @Body() dto: CreateUomDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.uomService.create(dto, user.companyId, user.userId);
  }

  @Patch(':id')
  @RequirePermission('inventory:update')
  @ApiOperation({ summary: 'Update a unit of measure' })
  @ApiParam({ name: 'id', type: 'string' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUomDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.uomService.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('inventory:delete')
  @ApiOperation({ summary: 'Delete a unit of measure' })
  @ApiParam({ name: 'id', type: 'string' })
  async delete(
    @Param('id') id: string,
    @Body('rowVersion') rowVersion: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.uomService.softDelete(
      id,
      user.companyId,
      rowVersion,
      user.userId,
    );
  }
}
