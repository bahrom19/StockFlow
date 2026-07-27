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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QuotationStatus } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CreateSupplierQuotationDto } from '../dto/create-supplier-quotation.dto';
import { SupplierQuotationQueryDto } from '../dto/supplier-quotation-query.dto';
import { SupplierQuotationEntity } from '../entities/supplier-quotation.entity';
import { SupplierQuotationService } from '../services/supplier-quotation.service';

@ApiTags('purchasing / quotations')
@Controller('purchasing/quotations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierQuotationController {
  constructor(private readonly service: SupplierQuotationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing:create')
  @ApiOperation({ summary: 'Create a supplier quotation' })
  @ApiBody({ type: CreateSupplierQuotationDto })
  @ApiResponse({ status: 201, type: SupplierQuotationEntity })
  async create(
    @Body() dto: CreateSupplierQuotationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SupplierQuotationEntity> {
    return this.service.create(dto, user.userId, user.companyId);
  }

  @Get()
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'List supplier quotations' })
  async findAll(
    @Query() query: SupplierQuotationQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'Get quotation by id' })
  @ApiParam({ name: 'id' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SupplierQuotationEntity> {
    return this.service.findById(id, user.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('purchasing:delete')
  @ApiOperation({ summary: 'Delete a draft quotation' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.softDelete(id, user.companyId);
  }

  @Patch(':id/status')
  @RequirePermission('purchasing:update')
  @ApiOperation({ summary: 'Transition quotation status' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'status', enum: QuotationStatus })
  async transitionStatus(
    @Param('id') id: string,
    @Query('status') status: QuotationStatus,
    @CurrentUser() user: JwtPayload,
  ): Promise<SupplierQuotationEntity> {
    return this.service.transitionStatus(
      id,
      status,
      user.userId,
      user.companyId,
    );
  }
}
