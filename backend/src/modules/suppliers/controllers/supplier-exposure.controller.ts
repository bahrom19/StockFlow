import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SupplierExposureService } from '../services/supplier-exposure.service';
import { SupplierExposureEntity } from '../entities/supplier-exposure.entity';

@ApiTags('suppliers / exposure')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers/:supplierId')
export class SupplierExposureController {
  constructor(
    private readonly exposureService: SupplierExposureService,
  ) {}

  @Get('open-po-exposure')
  @RequirePermission('suppliers:read')
  @ApiOperation({
    summary:
      'Get supplier open-PO exposure (read-only; base currency; no enforcement)',
  })
  @ApiParam({ name: 'supplierId', type: String })
  @ApiResponse({ status: 200, type: SupplierExposureEntity })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async getOpenPoExposure(
    @Param('supplierId') supplierId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SupplierExposureEntity> {
    return this.exposureService.getOpenPoExposure(
      supplierId,
      user.companyId,
    );
  }
}
