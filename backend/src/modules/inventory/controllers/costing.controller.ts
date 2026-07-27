import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CostingService } from '../services/costing.service';

@ApiTags('Inventory - Valuation')
@ApiBearerAuth()
@Controller('inventory/valuation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  @Get()
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get inventory valuation for all products' })
  @ApiOkResponse({ description: 'Inventory valuation list' })
  async getValuation(@CurrentUser() user: JwtPayload): Promise<any[]> {
    return this.costingService.getValuation(user.companyId);
  }

  @Get(':productId')
  @RequirePermission('inventory:read')
  @ApiOperation({ summary: 'Get inventory valuation for a specific product' })
  @ApiParam({ name: 'productId', type: 'string' })
  async getProductValuation(
    @Param('productId') productId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.costingService.getProductValuation(productId, user.companyId);
  }
}
