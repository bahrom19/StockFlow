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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateChartOfAccountDto } from '../dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from '../dto/update-chart-of-account.dto';
import { ChartOfAccountQueryDto } from '../dto/chart-of-account-query.dto';
import { ChartOfAccountEntity } from '../entities/chart-of-account.entity';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@ApiTags('finance / chart-of-accounts')
@Controller('finance/chart-of-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChartOfAccountsController {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:create')
  @ApiOperation({ summary: 'Create a chart of account' })
  @ApiBody({ type: CreateChartOfAccountDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Chart of account created',
    type: ChartOfAccountEntity,
  })
  async create(
    @Body() dto: CreateChartOfAccountDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    return this.chartOfAccountsService.create(dto, currentUser);
  }

  @Get()
  @RequirePermission('finance:read')
  @ApiOperation({
    summary: 'List chart of accounts with pagination and filters',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'accountType',
    required: false,
    enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
  })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiOkResponse({
    description: 'Chart of accounts retrieved',
    type: PaginatedResponseDto<ChartOfAccountEntity>,
  })
  async findAll(
    @Query() query: ChartOfAccountQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.chartOfAccountsService.findAll(query, currentUser);
  }

  @Get(':id')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Get chart of account by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chart of account retrieved',
    type: ChartOfAccountEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    return this.chartOfAccountsService.findById(id, currentUser);
  }

  @Patch(':id')
  @RequirePermission('finance:update')
  @ApiOperation({ summary: 'Update chart of account' })
  @ApiBody({ type: UpdateChartOfAccountDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chart of account updated',
    type: ChartOfAccountEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChartOfAccountDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    return this.chartOfAccountsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @RequirePermission('finance:delete')
  @ApiOperation({ summary: 'Soft delete chart of account' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chart of account soft deleted',
    type: ChartOfAccountEntity,
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    return this.chartOfAccountsService.softDelete(id, currentUser);
  }
}
