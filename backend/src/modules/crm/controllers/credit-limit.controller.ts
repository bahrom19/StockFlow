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
import { CreditLimitService } from '../services/credit-limit.service';
import { CreditLimitEntity } from '../entities/credit-limit.entity';
import {
  CreateCreditLimitDto,
  UpdateCreditLimitDto,
  CreditLimitQueryDto,
} from '../dto/credit-limit.dto';

@ApiTags('crm / credit-limits')
@Controller('crm/credit-limits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CreditLimitController {
  constructor(private readonly service: CreditLimitService) {}

  @Post()
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create credit limit' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CreditLimitEntity })
  async create(
    @Body() dto: CreateCreditLimitDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreditLimitEntity> {
    return this.service.create(dto, user.companyId, user.userId);
  }

  @Get()
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List credit limits' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(
    @Query() query: CreditLimitQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get credit limit by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: CreditLimitEntity })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreditLimitEntity> {
    return this.service.findOne(id, user.companyId);
  }

  @Get('customer/:customerId')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get credit limit by customer' })
  @ApiParam({ name: 'customerId', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: CreditLimitEntity })
  async findByCustomer(
    @Param('customerId') customerId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreditLimitEntity | null> {
    return this.service.findByCustomer(customerId);
  }

  @Patch(':id')
  @RequirePermission('crm:update')
  @ApiOperation({ summary: 'Update credit limit' })
  @ApiBody({ type: UpdateCreditLimitDto })
  @ApiResponse({ status: HttpStatus.OK, type: CreditLimitEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCreditLimitDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreditLimitEntity> {
    return this.service.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('crm:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete credit limit' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user.companyId, user.userId);
  }
}
