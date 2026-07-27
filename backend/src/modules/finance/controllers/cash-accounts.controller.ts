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
import { CreateCashAccountDto } from '../dto/create-cash-account.dto';
import { UpdateCashAccountDto } from '../dto/update-cash-account.dto';
import { CashAccountQueryDto } from '../dto/cash-account-query.dto';
import { CashAccountEntity } from '../entities/cash-account.entity';
import { CashAccountsService } from '../services/cash-accounts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@ApiTags('finance / cash-accounts')
@Controller('finance/cash-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashAccountsController {
  constructor(private readonly cashAccountsService: CashAccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:create')
  @ApiOperation({ summary: 'Create a cash account' })
  @ApiBody({ type: CreateCashAccountDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Cash account created',
    type: CashAccountEntity,
  })
  async create(
    @Body() dto: CreateCashAccountDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CashAccountEntity> {
    return this.cashAccountsService.create(dto, currentUser);
  }

  @Get()
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'List cash accounts with pagination and filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiOkResponse({
    description: 'Cash accounts retrieved',
    type: PaginatedResponseDto<CashAccountEntity>,
  })
  async findAll(
    @Query() query: CashAccountQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.cashAccountsService.findAll(query, currentUser);
  }

  @Get(':id')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Get cash account by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cash account retrieved',
    type: CashAccountEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CashAccountEntity> {
    return this.cashAccountsService.findById(id, currentUser);
  }

  @Patch(':id')
  @RequirePermission('finance:update')
  @ApiOperation({ summary: 'Update cash account' })
  @ApiBody({ type: UpdateCashAccountDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cash account updated',
    type: CashAccountEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCashAccountDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CashAccountEntity> {
    return this.cashAccountsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @RequirePermission('finance:delete')
  @ApiOperation({ summary: 'Soft delete cash account' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cash account soft deleted',
    type: CashAccountEntity,
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CashAccountEntity> {
    return this.cashAccountsService.softDelete(id, currentUser);
  }
}
