import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SupplierStatementService } from '../services/supplier-statement.service';
import { SupplierStatementQueryDto } from '../dto/supplier-statement-query.dto';
import { SupplierStatementEntity } from '../entities/supplier-statement.entity';

@ApiTags('suppliers / statement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers/:supplierId')
export class SupplierStatementController {
  constructor(private readonly statementService: SupplierStatementService) {}

  @Get('statement')
  @RequirePermission('suppliers:read')
  @ApiOperation({
    summary:
      'Get supplier AP statement (operational subledger) with running balance per currency',
  })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Statement start business date (inclusive)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'Statement end business date (inclusive)',
  })
  @ApiQuery({ name: 'currency', required: false, enum: Currency })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: SupplierStatementEntity })
  async getStatement(
    @Param('supplierId') supplierId: string,
    @Query() query: SupplierStatementQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.statementService.getStatement(
      supplierId,
      user.companyId,
      query,
    );
  }
}
