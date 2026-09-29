import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductQueryDto } from '../dto/product-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { SetCostPriceDto } from '../dto/set-cost-price.dto';
import { ProductEntity } from '../entities/product.entity';
import { ProductsService } from '../services/products.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('products:create')
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Creates a product. If stockQuantity is provided (>0), it is attributed ' +
      'to the company default (or first) active warehouse; if no active ' +
      'warehouse exists, the request fails with 422 so the initial stock is ' +
      'never silently lost.',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created successfully',
    type: ProductEntity,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description:
      'stockQuantity was requested but no active warehouse exists for the company',
  })
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() currentUser: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ProductEntity> {
    return this.productsService.create(
      createProductDto,
      currentUser,
      idempotencyKey,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List products with pagination and filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'sku', required: false })
  @ApiQuery({ name: 'barcode', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
  })
  async findAll(
    @Query() query: ProductQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.productsService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product retrieved successfully',
    type: ProductEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ProductEntity> {
    return this.productsService.findById(id, currentUser);
  }

  @Patch(':id')
  @RequirePermission('products:update')
  @ApiOperation({ summary: 'Update a product' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product updated successfully',
    type: ProductEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ProductEntity> {
    return this.productsService.update(id, updateProductDto, currentUser);
  }

  /**
   * G16-H-2 (B4): manual cost-price reconciliation. Sets costPrice on a
   * currently unvalued product (Decimal(0) allowed). Idempotent for the
   * same value; 409 if a different costPrice already exists. No layers/GL.
   */
  @Patch(':id/cost-price')
  @RequirePermission('products:update')
  @ApiOperation({
    summary: 'Set cost price on an unvalued product (B4 remediation)',
    description:
      'Manual cost-price reconciliation for legacy unvalued stock. Only ' +
      'moves costPrice from NULL to an explicit value (zero allowed); an ' +
      'existing costPrice is never overwritten. Writes an audit record in ' +
      'the same transaction. No cost layers, stock movements or GL entries.',
  })
  @ApiBody({ type: SetCostPriceDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cost price set (or idempotent no-op)',
    type: ProductEntity,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Product already has a cost price (no silent overwrite)',
  })
  async setCostPrice(
    @Param('id') id: string,
    @Body() dto: SetCostPriceDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ProductEntity> {
    return this.productsService.remediateCostPrice(id, dto, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a product' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product soft-deleted successfully',
    type: ProductEntity,
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ProductEntity> {
    return this.productsService.softDelete(id, currentUser);
  }
}
