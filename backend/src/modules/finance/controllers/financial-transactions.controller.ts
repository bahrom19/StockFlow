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
import { CreateFinancialTransactionDto } from '../dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from '../dto/update-financial-transaction.dto';
import { FinancialTransactionQueryDto } from '../dto/financial-transaction-query.dto';
import { FinancialTransactionEntity } from '../entities/financial-transaction.entity';
import { FinancialTransactionsService } from '../services/financial-transactions.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@ApiTags('finance / financial-transactions')
@Controller('finance/financial-transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialTransactionsController {
  constructor(
    private readonly financialTransactionsService: FinancialTransactionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:create')
  @ApiOperation({ summary: 'Create a financial transaction' })
  @ApiBody({ type: CreateFinancialTransactionDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Financial transaction created',
    type: FinancialTransactionEntity,
  })
  async create(
    @Body() dto: CreateFinancialTransactionDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<FinancialTransactionEntity> {
    return this.financialTransactionsService.create(dto, currentUser);
  }

  @Get()
  @RequirePermission('finance:read')
  @ApiOperation({
    summary: 'List financial transactions with pagination and filters',
  })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'direction', required: false })
  @ApiQuery({ name: 'cashAccountId', required: false })
  @ApiQuery({ name: 'bankAccountId', required: false })
  @ApiQuery({ name: 'isReconciled', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiOkResponse({
    description: 'Financial transactions retrieved',
    type: PaginatedResponseDto<FinancialTransactionEntity>,
  })
  async findAll(
    @Query() query: FinancialTransactionQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.financialTransactionsService.findAll(query, currentUser);
  }

  @Get(':id')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Get financial transaction by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Financial transaction retrieved',
    type: FinancialTransactionEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<FinancialTransactionEntity> {
    return this.financialTransactionsService.findById(id, currentUser);
  }

  @Patch(':id')
  @RequirePermission('finance:update')
  @ApiOperation({ summary: 'Update financial transaction' })
  @ApiBody({ type: UpdateFinancialTransactionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Financial transaction updated',
    type: FinancialTransactionEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialTransactionDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<FinancialTransactionEntity> {
    return this.financialTransactionsService.update(id, dto, currentUser);
  }
}
