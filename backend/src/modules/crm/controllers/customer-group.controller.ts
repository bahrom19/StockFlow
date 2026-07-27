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
import { CustomerGroupService } from '../services/customer-group.service';
import { CustomerGroupEntity } from '../entities/customer-group.entity';
import {
  CreateCustomerGroupDto,
  UpdateCustomerGroupDto,
  CustomerGroupQueryDto,
} from '../dto/customer-group.dto';

@ApiTags('crm / customer-groups')
@Controller('crm/customer-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerGroupController {
  constructor(private readonly service: CustomerGroupService) {}

  @Post()
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create customer group' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CustomerGroupEntity })
  async create(
    @Body() dto: CreateCustomerGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerGroupEntity> {
    return this.service.create(dto, user.companyId, user.userId);
  }

  @Get()
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List customer groups' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(
    @Query() query: CustomerGroupQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get customer group by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: CustomerGroupEntity })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerGroupEntity> {
    return this.service.findOne(id, user.companyId);
  }

  @Patch(':id')
  @RequirePermission('crm:update')
  @ApiOperation({ summary: 'Update customer group' })
  @ApiBody({ type: UpdateCustomerGroupDto })
  @ApiResponse({ status: HttpStatus.OK, type: CustomerGroupEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerGroupEntity> {
    return this.service.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('crm:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete customer group' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user.companyId, user.userId);
  }
}
