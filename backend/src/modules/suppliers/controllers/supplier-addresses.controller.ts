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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSupplierAddressDto } from '../dto/create-supplier-address.dto';
import { UpdateSupplierAddressDto } from '../dto/update-supplier-address.dto';
import { SupplierAddressEntity } from '../entities/supplier-address.entity';
import { SupplierAddressesService } from '../services/supplier-addresses.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('suppliers / addresses')
@Controller('suppliers/:supplierId/addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierAddressesController {
  constructor(private readonly addressesService: SupplierAddressesService) {}

  @Get()
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'List supplier addresses' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Addresses retrieved',
    type: [SupplierAddressEntity],
  })
  async findAll(
    @Param('supplierId') supplierId: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierAddressEntity[]> {
    return this.addressesService.findAll(supplierId, currentUser);
  }

  @Get(':addressId')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier address by id' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiParam({ name: 'addressId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Address retrieved',
    type: SupplierAddressEntity,
  })
  async findById(
    @Param('supplierId') supplierId: string,
    @Param('addressId') addressId: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierAddressEntity> {
    return this.addressesService.findById(supplierId, addressId, currentUser);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Create a supplier address' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiBody({ type: CreateSupplierAddressDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Address created',
    type: SupplierAddressEntity,
  })
  async create(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierAddressDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierAddressEntity> {
    return this.addressesService.create(supplierId, dto, currentUser);
  }

  @Patch(':addressId')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Update a supplier address' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiParam({ name: 'addressId', type: 'string' })
  @ApiBody({ type: UpdateSupplierAddressDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Address updated',
    type: SupplierAddressEntity,
  })
  async update(
    @Param('supplierId') supplierId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateSupplierAddressDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierAddressEntity> {
    return this.addressesService.update(
      supplierId,
      addressId,
      dto,
      currentUser,
    );
  }

  @Delete(':addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Soft delete a supplier address' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiParam({ name: 'addressId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Address soft deleted',
  })
  async softDelete(
    @Param('supplierId') supplierId: string,
    @Param('addressId') addressId: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    await this.addressesService.softDelete(supplierId, addressId, currentUser);
  }
}
