import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import {
  BarcodeService,
  CreateBarcodeDto,
  UpdateBarcodeDto,
} from '../services/barcode.service';

@ApiTags('Inventory - Barcodes')
@ApiBearerAuth()
@Controller('inventory/barcodes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarcodeController {
  constructor(private readonly barcodeService: BarcodeService) {}

  @Get('search')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Search products by barcode' })
  @ApiQuery({ name: 'q', type: 'string' })
  async search(
    @Query('q') q: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<any[]> {
    return this.barcodeService.search(q, user.companyId);
  }

  @Get(':productId')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get barcodes for a product' })
  @ApiParam({ name: 'productId', type: 'string' })
  async findByProduct(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<any[]> {
    return this.barcodeService.findByProduct(productId, user.companyId);
  }

  @Get(':productId/generate')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Generate a new barcode for a product' })
  @ApiParam({ name: 'productId', type: 'string' })
  async generate(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ barcode: string }> {
    return this.barcodeService.generate(productId, user.companyId);
  }

  @Post()
  @RequirePermission('inventory:create')
  @ApiOperation({ summary: 'Create a barcode for a product' })
  async create(
    @Body() dto: CreateBarcodeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.barcodeService.create(dto, user.companyId, user.userId);
  }

  @Patch(':id')
  @RequirePermission('inventory:update')
  @ApiOperation({ summary: 'Update a barcode' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBarcodeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.barcodeService.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('inventory:delete')
  @ApiOperation({ summary: 'Delete a barcode' })
  async delete(
    @Param('id') id: string,
    @Body('rowVersion') rowVersion: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.barcodeService.softDelete(
      id,
      user.companyId,
      rowVersion,
      user.userId,
    );
  }
}
