import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { LoyaltyService } from '../services/loyalty.service';
import { LoyaltyAccountEntity } from '../entities/loyalty-account.entity';
import {
  EarnPointsDto,
  RedeemPointsDto,
  LoyaltyQueryDto,
} from '../dto/loyalty.dto';

@ApiTags('crm / loyalty')
@Controller('crm/loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoyaltyController {
  constructor(private readonly service: LoyaltyService) {}

  @Get(':customerId')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get loyalty account' })
  @ApiParam({ name: 'customerId', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: LoyaltyAccountEntity })
  async getAccount(
    @Param('customerId') customerId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<LoyaltyAccountEntity> {
    return this.service.getAccount(customerId);
  }

  @Post('earn')
  @RequirePermission('crm:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Earn loyalty points' })
  @ApiBody({ type: EarnPointsDto })
  @ApiResponse({ status: HttpStatus.CREATED, type: LoyaltyAccountEntity })
  async earnPoints(
    @Body() dto: EarnPointsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LoyaltyAccountEntity> {
    return this.service.earnPoints(dto, user.companyId, user.userId);
  }

  @Post('redeem')
  @RequirePermission('crm:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Redeem loyalty points' })
  @ApiBody({ type: RedeemPointsDto })
  @ApiResponse({ status: HttpStatus.CREATED, type: LoyaltyAccountEntity })
  async redeemPoints(
    @Body() dto: RedeemPointsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LoyaltyAccountEntity> {
    return this.service.redeemPoints(dto, user.companyId, user.userId);
  }

  @Get(':accountId/transactions')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get loyalty transactions' })
  @ApiParam({ name: 'accountId', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK })
  async getTransactions(
    @Param('accountId') accountId: string,
    @Query() query: LoyaltyQueryDto,
  ) {
    return this.service.getTransactions(accountId, query);
  }
}
