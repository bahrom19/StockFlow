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
  VariantService,
  CreateVariantDto,
  UpdateVariantDto,
} from '../services/variant.service';

@ApiTags('Inventory - Variants')
@ApiBearerAuth()
@Controller('inventory/variants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  @Get(':productId')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get variants for a product' })
  @ApiParam({ name: 'productId', type: 'string' })
  @ApiOkResponse({ description: 'Product variants' })
  async findByProduct(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<any[]> {
    return this.variantService.findByProduct(productId, user.companyId);
  }

  @Get(':productId/generate-sku')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Generate a new SKU for a product variant' })
  @ApiParam({ name: 'productId', type: 'string' })
  async generateSku(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ sku: string }> {
    return this.variantService.generateSku(productId, user.companyId);
  }

  @Post()
  @RequirePermission('inventory:create')
  @ApiOperation({ summary: 'Create a product variant' })
  async create(
    @Body() dto: CreateVariantDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.variantService.create(dto, user.companyId, user.userId);
  }

  @Patch(':id')
  @RequirePermission('inventory:update')
  @ApiOperation({ summary: 'Update a product variant' })
  @ApiParam({ name: 'id', type: 'string' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.variantService.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('inventory:delete')
  @ApiOperation({ summary: 'Soft delete a variant' })
  @ApiParam({ name: 'id', type: 'string' })
  async delete(
    @Param('id') id: string,
    @Body('rowVersion') rowVersion: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.variantService.softDelete(
      id,
      user.companyId,
      rowVersion,
      user.userId,
    );
  }
}
