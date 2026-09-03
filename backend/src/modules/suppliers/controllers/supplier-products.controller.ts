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
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SupplierProductsService } from '../services/supplier-products.service';
import { CreateSupplierProductDto } from '../dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from '../dto/update-supplier-product.dto';
import { SupplierProductEntity } from '../entities/supplier-product.entity';

@ApiTags('suppliers / products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers/:supplierId/products')
export class SupplierProductsController {
  constructor(private readonly productsService: SupplierProductsService) {}

  // ─────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────

  @Get()
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'List supplier products' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isPreferred', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @ApiResponse({ status: 200 })
  async findAll(
    @Param('supplierId') supplierId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('isPreferred') isPreferred?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.productsService.findAll(supplierId, user!.companyId, {
      page: page ?? 1,
      limit: limit ?? 20,
      search,
      isPreferred: isPreferred !== undefined ? isPreferred === 'true' : undefined,
      sortBy,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    });
  }

  // ─────────────────────────────────────────────
  // GET BY ID
  // ─────────────────────────────────────────────

  @Get(':spId')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier product by id' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiParam({ name: 'spId', type: String })
  @ApiResponse({ status: 200, type: SupplierProductEntity })
  async findById(
    @Param('supplierId') supplierId: string,
    @Param('spId') spId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.findById(spId, supplierId, user.companyId);
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Add product to supplier catalog' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiResponse({ status: 201, type: SupplierProductEntity })
  async create(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.create(supplierId, dto, user.companyId);
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  @Patch(':spId')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Update supplier product' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiParam({ name: 'spId', type: String })
  @ApiResponse({ status: 200, type: SupplierProductEntity })
  async update(
    @Param('supplierId') supplierId: string,
    @Param('spId') spId: string,
    @Body() dto: UpdateSupplierProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.update(spId, supplierId, user.companyId, dto);
  }

  // ─────────────────────────────────────────────
  // DELETE (soft)
  // ─────────────────────────────────────────────

  @Delete(':spId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Remove product from supplier catalog' })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiParam({ name: 'spId', type: String })
  async remove(
    @Param('supplierId') supplierId: string,
    @Param('spId') spId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.remove(spId, supplierId, user.companyId);
  }
}
