import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { SalesRefundEntity } from '../entities/sales-refund.entity';
import { SalesRefundService } from '../services/sales-refund.service';

/**
 * G11-E E2 — refund endpoint.
 *
 * Owns the canonical compatibility route `POST /sales/:id/refund` (previously on
 * `SalesController`). There is exactly ONE handler for this route.
 *
 * Semantics: refund ALL REMAINING quantities, or an explicit partial set of
 * `{ saleItemId, quantity }` lines. Amounts and historical cost are always
 * computed server-side.
 */
@ApiTags('sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesRefundController {
  constructor(private readonly salesRefundService: SalesRefundService) {}

  @Post(':id/refund')
  @RequirePermission('sales:refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Refund a sale — all remaining quantities, or explicit partial lines',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: CreateRefundDto, required: false })
  @ApiResponse({
    status: 200,
    description: 'Refund created',
    type: SalesRefundEntity,
  })
  async refund(
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SalesRefundEntity> {
    return this.salesRefundService.createRefund(
      id,
      dto ?? {},
      user.userId,
      user.companyId,
    );
  }
}