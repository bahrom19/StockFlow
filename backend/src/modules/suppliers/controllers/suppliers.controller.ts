import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { SupplierQueryDto } from '../dto/supplier-query.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { SupplierEntity } from '../entities/supplier.entity';
import { SuppliersService } from '../services/suppliers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('suppliers:create')
  @ApiOperation({ summary: 'Create a supplier' })
  @ApiBody({ type: CreateSupplierDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Supplier created',
    type: SupplierEntity,
  })
  async create(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierEntity> {
    return this.suppliersService.create(createSupplierDto, currentUser);
  }

  @Get()
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'List suppliers' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Suppliers retrieved',
    type: [SupplierEntity],
  })
  async findAll(
    @Query() query: SupplierQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{
    items: SupplierEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.suppliersService.findAll(query, currentUser);
  }

  // G1: company-name duplicate warning. STATIC route — must be declared
  // BEFORE @Get(':id') or NestJS would match /suppliers/duplicates as :id.
  @Get('duplicates')
  @RequirePermission('suppliers:read')
  @ApiOperation({
    summary:
      'Check for active suppliers with the same normalized company name (non-blocking warning)',
  })
  @ApiQuery({ name: 'companyName', required: true, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Active suppliers with an equal normalized name (may be empty)',
    type: [SupplierEntity],
  })
  async checkDuplicates(
    @Query('companyName') companyName: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierEntity[]> {
    return this.suppliersService.checkDuplicateName(
      companyName ?? '',
      currentUser,
    );
  }

  @Get(':id')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Supplier retrieved',
    type: SupplierEntity,
  })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierEntity> {
    return this.suppliersService.findById(id, currentUser);
  }

  @Patch(':id')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Update supplier' })
  @ApiBody({ type: UpdateSupplierDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Supplier updated',
    type: SupplierEntity,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierEntity> {
    return this.suppliersService.update(id, updateSupplierDto, currentUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('suppliers:delete')
  @ApiOperation({ summary: 'Soft delete supplier' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Supplier soft deleted',
  })
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    await this.suppliersService.softDelete(id, currentUser);
  }
}
