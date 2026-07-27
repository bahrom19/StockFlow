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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { CustomerQueryDto } from '../dto/customer-query.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CustomerEntity } from '../entities/customer.entity';
import { CustomersService } from '../services/customers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @RequirePermission('crm:create')
  @ApiOperation({ summary: 'Create a customer' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Customer created',
    type: CustomerEntity,
  })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CustomerEntity> {
    return this.customersService.create(createCustomerDto, currentUser);
  }

  @Get()
  @UseGuards(RolesGuard)
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List customers' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Customers retrieved' })
  async findAll(
    @Query() query: CustomerQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{
    items: CustomerEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.customersService.findAll(query, currentUser);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get customer by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer retrieved',
    type: CustomerEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CustomerEntity> {
    return this.customersService.findById(id, currentUser);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequirePermission('crm:update')
  @ApiOperation({ summary: 'Update customer' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer updated',
    type: CustomerEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CustomerEntity> {
    return this.customersService.update(id, updateCustomerDto, currentUser);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequirePermission('crm:delete')
  @ApiOperation({ summary: 'Soft delete customer' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer soft deleted',
    type: CustomerEntity,
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CustomerEntity> {
    return this.customersService.softDelete(id, currentUser);
  }
}
