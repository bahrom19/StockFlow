import {
  Body,
  Controller,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateFinancialPeriodDto } from '../dto/create-financial-period.dto';
import { UpdateFinancialPeriodDto } from '../dto/update-financial-period.dto';
import { FinancialPeriodQueryDto } from '../dto/financial-period-query.dto';
import { FinancialPeriodEntity } from '../entities/financial-period.entity';
import { FinancialPeriodsService } from '../services/financial-periods.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@ApiTags('finance / financial-periods')
@Controller('finance/financial-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialPeriodsController {
  constructor(
    private readonly financialPeriodsService: FinancialPeriodsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:create')
  @ApiOperation({ summary: 'Create a financial period' })
  @ApiBody({ type: CreateFinancialPeriodDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Financial period created',
    type: FinancialPeriodEntity,
  })
  async create(
    @Body() dto: CreateFinancialPeriodDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<FinancialPeriodEntity> {
    return this.financialPeriodsService.create(dto, currentUser);
  }

  @Get()
  @RequirePermission('finance:read')
  @ApiOperation({
    summary: 'List financial periods with pagination and filters',
  })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['OPEN', 'CLOSING', 'CLOSED'],
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiOkResponse({
    description: 'Financial periods retrieved',
    type: PaginatedResponseDto<FinancialPeriodEntity>,
  })
  async findAll(
    @Query() query: FinancialPeriodQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.financialPeriodsService.findAll(query, currentUser);
  }

  @Get(':id')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Get financial period by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Financial period retrieved',
    type: FinancialPeriodEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<FinancialPeriodEntity> {
    return this.financialPeriodsService.findById(id, currentUser);
  }

  @Patch(':id')
  @RequirePermission('finance:update')
  @ApiOperation({ summary: 'Update financial period' })
  @ApiBody({ type: UpdateFinancialPeriodDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Financial period updated',
    type: FinancialPeriodEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialPeriodDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<FinancialPeriodEntity> {
    return this.financialPeriodsService.update(id, dto, currentUser);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:period-close')
  @ApiOperation({ summary: 'Close financial period' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Financial period closed',
    type: FinancialPeriodEntity,
  })
  async close(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<FinancialPeriodEntity> {
    return this.financialPeriodsService.close(id, currentUser);
  }
}
