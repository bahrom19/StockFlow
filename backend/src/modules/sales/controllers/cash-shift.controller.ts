import {
  Body,
  Controller,
  Get,
  Headers,
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import {
  CashInOutDto,
  CloseShiftDto,
  OpenShiftDto,
} from '../dto/cash-shift.dto';
import { CashShiftEntity } from '../entities/cash-shift.entity';
import { CashShiftService } from '../services/cash-shift.service';

@ApiTags('sales / cash-shifts')
@Controller('sales/cash-shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashShiftController {
  constructor(private readonly cashShiftService: CashShiftService) {}

  @Post('open')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('sales:shift')
  @ApiOperation({ summary: 'Open a cash shift' })
  @ApiBody({ type: OpenShiftDto })
  @ApiResponse({
    status: 201,
    description: 'Shift opened',
    type: CashShiftEntity,
  })
  async openShift(
    @Body() dto: OpenShiftDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CashShiftEntity> {
    return this.cashShiftService.openShift(dto, user.userId, user.companyId);
  }

  @Post('close')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales:shift')
  @ApiOperation({ summary: 'Close the current cash shift' })
  @ApiBody({ type: CloseShiftDto })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiResponse({
    status: 200,
    description: 'Shift closed',
    type: CashShiftEntity,
  })
  async closeShift(
    @Body() dto: CloseShiftDto,
    @Query('warehouseId') warehouseId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CashShiftEntity> {
    return this.cashShiftService.closeShift(
      dto,
      user.userId,
      user.companyId,
      warehouseId,
    );
  }

  @Post('cash-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales:shift')
  @ApiOperation({ summary: 'Cash in during shift' })
  @ApiBody({ type: CashInOutDto })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiResponse({
    status: 200,
    description: 'Cash in recorded',
    type: CashShiftEntity,
  })
  async cashIn(
    @Body() dto: CashInOutDto,
    @Query('warehouseId') warehouseId: string,
    @CurrentUser() user: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CashShiftEntity> {
    return this.cashShiftService.cashIn(
      dto,
      user.userId,
      user.companyId,
      warehouseId,
      idempotencyKey,
    );
  }

  @Post('cash-out')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales:shift')
  @ApiOperation({ summary: 'Cash out during shift' })
  @ApiBody({ type: CashInOutDto })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiResponse({
    status: 200,
    description: 'Cash out recorded',
    type: CashShiftEntity,
  })
  async cashOut(
    @Body() dto: CashInOutDto,
    @Query('warehouseId') warehouseId: string,
    @CurrentUser() user: JwtPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CashShiftEntity> {
    return this.cashShiftService.cashOut(
      dto,
      user.userId,
      user.companyId,
      warehouseId,
      idempotencyKey,
    );
  }

  @Get('x-report')
  @RequirePermission('sales:shift')
  @ApiOperation({ summary: 'X report (current shift summary)' })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiResponse({ status: 200, description: 'X report', type: CashShiftEntity })
  async xReport(
    @Query('warehouseId') warehouseId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CashShiftEntity> {
    return this.cashShiftService.getXReport(
      user.userId,
      user.companyId,
      warehouseId,
    );
  }

  @Get('z-report/:id')
  @RequirePermission('sales:shift')
  @ApiOperation({ summary: 'Z report (closed shift summary)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Z report', type: CashShiftEntity })
  async zReport(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CashShiftEntity> {
    return this.cashShiftService.getZReport(id, user.companyId);
  }

  @Get()
  @RequirePermission('sales:shift')
  @ApiOperation({ summary: 'List all cash shifts' })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Shifts retrieved' })
  async listShifts(
    @CurrentUser() user: JwtPayload,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    items: CashShiftEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.cashShiftService.listShifts(user.companyId, {
      warehouseId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
