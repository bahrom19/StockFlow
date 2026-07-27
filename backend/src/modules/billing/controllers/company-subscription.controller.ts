import {
  Body,
  Controller,
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
  ApiBearerAuth,
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
import { CompanySubscriptionService } from '../services/company-subscription.service';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { SubscriptionQueryDto } from '../dto/subscription-query.dto';
import { CompanySubscriptionEntity } from '../entities/company-subscription.entity';

@ApiTags('billing / subscriptions')
@ApiBearerAuth()
@Controller('billing/subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanySubscriptionController {
  constructor(private readonly subscriptionService: CompanySubscriptionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('billing:create')
  @ApiOperation({ summary: 'Create subscription (trial) for company' })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiResponse({ status: 201, description: 'Subscription created', type: CompanySubscriptionEntity })
  async create(
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompanySubscriptionEntity> {
    return this.subscriptionService.create(user.companyId, dto, user.userId);
  }

  @Get()
  @RequirePermission('billing:read')
  @ApiOperation({ summary: 'Get current company subscription' })
  @ApiResponse({ status: 200, description: 'Subscription retrieved', type: CompanySubscriptionEntity })
  async getMySubscription(
    @CurrentUser() user: JwtPayload,
  ): Promise<CompanySubscriptionEntity> {
    return this.subscriptionService.findByCompany(user.companyId);
  }

  @Get('all')
  @RequirePermission('admin:billing')
  @ApiOperation({ summary: 'List all subscriptions (admin)' })
  async findAll(
    @Query() query: SubscriptionQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ items: CompanySubscriptionEntity[]; total: number; page: number; limit: number }> {
    const isAdmin = user.roles?.includes('admin');
    const companyId = isAdmin ? undefined : user.companyId;
    return this.subscriptionService.findAll(query, companyId);
  }

  @Patch('plan')
  @RequirePermission('billing:update')
  @ApiOperation({ summary: 'Change plan (upgrade/downgrade)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        planCode: { type: 'string', example: 'business' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Plan changed', type: CompanySubscriptionEntity })
  async changePlan(
    @Body('planCode') planCode: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompanySubscriptionEntity> {
    return this.subscriptionService.changePlan(user.companyId, planCode, user.userId);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('billing:update')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Subscription cancelled', type: CompanySubscriptionEntity })
  async cancel(
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompanySubscriptionEntity> {
    return this.subscriptionService.cancel(user.companyId, reason, user.userId);
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('billing:update')
  @ApiOperation({ summary: 'Resume cancelled subscription' })
  @ApiResponse({ status: 200, description: 'Subscription resumed', type: CompanySubscriptionEntity })
  async resume(@CurrentUser() user: JwtPayload): Promise<CompanySubscriptionEntity> {
    return this.subscriptionService.resume(user.companyId, user.userId);
  }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('admin:billing')
  @ApiOperation({ summary: 'Transition subscription status (admin)' })
  @ApiQuery({ name: 'status', required: true, enum: ['ACTIVE', 'SUSPENDED', 'EXPIRED'] })
  @ApiResponse({ status: 200, description: 'Status transitioned', type: CompanySubscriptionEntity })
  async transitionStatus(
    @CurrentUser() user: JwtPayload,
    @Query('status') status: string,
  ): Promise<CompanySubscriptionEntity> {
    return this.subscriptionService.transitionStatus(user.companyId, status, user.userId);
  }

  @Get(':id')
  @RequirePermission('billing:read')
  @ApiOperation({ summary: 'Get subscription by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Subscription retrieved', type: CompanySubscriptionEntity })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompanySubscriptionEntity> {
    return this.subscriptionService.findById(id, user.companyId);
  }
}
