import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CustomerAddressService } from '../services/customer-address.service';
import { CustomerAddressEntity } from '../entities/customer-address.entity';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
  CustomerAddressQueryDto,
} from '../dto/customer-address.dto';

@ApiTags('crm / addresses')
@Controller('crm/addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerAddressController {
  constructor(private readonly service: CustomerAddressService) {}

  @Post()
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create customer address' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CustomerAddressEntity })
  async create(
    @Body() dto: CreateCustomerAddressDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerAddressEntity> {
    return this.service.create(dto, user.companyId, user.userId);
  }

  @Get()
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List customer addresses' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(
    @Query() query: CustomerAddressQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get address by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: CustomerAddressEntity })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerAddressEntity> {
    return this.service.findOne(id, user.companyId);
  }

  @Patch(':id')
  @RequirePermission('crm:update')
  @ApiOperation({ summary: 'Update address' })
  @ApiBody({ type: UpdateCustomerAddressDto })
  @ApiResponse({ status: HttpStatus.OK, type: CustomerAddressEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerAddressDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerAddressEntity> {
    return this.service.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('crm:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete address' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user.companyId, user.userId);
  }
}
