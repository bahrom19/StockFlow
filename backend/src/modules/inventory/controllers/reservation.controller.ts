import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import {
  ReservationService,
  ReserveStockDto,
  ReleaseReservationDto,
} from '../services/reservation.service';

@ApiTags('Inventory - Reservations')
@ApiBearerAuth()
@Controller('inventory/reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Post('reserve')
  @RequirePermission('inventory:reserve')
  @ApiOperation({ summary: 'Reserve stock for an order' })
  async reserve(
    @Body() dto: ReserveStockDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.reservationService.reserve(dto, user.companyId, user.userId);
  }

  @Post('release')
  @RequirePermission('inventory:reserve')
  @ApiOperation({ summary: 'Release reserved stock' })
  async release(
    @Body() dto: ReleaseReservationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    return this.reservationService.release(dto, user.companyId, user.userId);
  }
}
