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
import { CreateBankAccountDto } from '../dto/create-bank-account.dto';
import { UpdateBankAccountDto } from '../dto/update-bank-account.dto';
import { BankAccountQueryDto } from '../dto/bank-account-query.dto';
import { BankAccountEntity } from '../entities/bank-account.entity';
import { BankAccountsService } from '../services/bank-accounts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@ApiTags('finance / bank-accounts')
@Controller('finance/bank-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:create')
  @ApiOperation({ summary: 'Create a bank account' })
  @ApiBody({ type: CreateBankAccountDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Bank account created',
    type: BankAccountEntity,
  })
  async create(
    @Body() dto: CreateBankAccountDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<BankAccountEntity> {
    return this.bankAccountsService.create(dto, currentUser);
  }

  @Get()
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'List bank accounts with pagination and filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiOkResponse({
    description: 'Bank accounts retrieved',
    type: PaginatedResponseDto<BankAccountEntity>,
  })
  async findAll(
    @Query() query: BankAccountQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.bankAccountsService.findAll(query, currentUser);
  }

  @Get(':id')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Get bank account by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bank account retrieved',
    type: BankAccountEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<BankAccountEntity> {
    return this.bankAccountsService.findById(id, currentUser);
  }

  @Patch(':id')
  @RequirePermission('finance:update')
  @ApiOperation({ summary: 'Update bank account' })
  @ApiBody({ type: UpdateBankAccountDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bank account updated',
    type: BankAccountEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<BankAccountEntity> {
    return this.bankAccountsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @RequirePermission('finance:delete')
  @ApiOperation({ summary: 'Soft delete bank account' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bank account soft deleted',
    type: BankAccountEntity,
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<BankAccountEntity> {
    return this.bankAccountsService.softDelete(id, currentUser);
  }
}
