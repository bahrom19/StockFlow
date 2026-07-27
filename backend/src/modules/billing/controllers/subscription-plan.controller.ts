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
  ApiBearerAuth,
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
import { SubscriptionPlanService } from '../services/subscription-plan.service';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import { SubscriptionPlanQueryDto } from '../dto/subscription-plan-query.dto';
import { SubscriptionPlanEntity } from '../entities/subscription-plan.entity';

@ApiTags('billing / subscription-plans')
@ApiBearerAuth()
@Controller('billing/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionPlanController {
  constructor(private readonly planService: SubscriptionPlanService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('admin:billing')
  @ApiOperation({ summary: 'Create a subscription plan' })
  @ApiBody({ type: CreateSubscriptionPlanDto })
  @ApiResponse({ status: 201, description: 'Plan created', type: SubscriptionPlanEntity })
  async create(
    @Body() dto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanEntity> {
    return this.planService.create(dto);
  }

  @Get()
  @RequirePermission('billing:read')
  @ApiOperation({ summary: 'List subscription plans' })
  @ApiResponse({ status: 200, description: 'Plans retrieved' })
  async findAll(
    @Query() query: SubscriptionPlanQueryDto,
  ): Promise<{ items: SubscriptionPlanEntity[]; total: number; page: number; limit: number }> {
    return this.planService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('billing:read')
  @ApiOperation({ summary: 'Get plan by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Plan retrieved', type: SubscriptionPlanEntity })
  async findById(@Param('id') id: string): Promise<SubscriptionPlanEntity> {
    return this.planService.findById(id);
  }

  @Get('code/:code')
  @RequirePermission('billing:read')
  @ApiOperation({ summary: 'Get plan by code' })
  @ApiParam({ name: 'code', type: 'string' })
  @ApiResponse({ status: 200, description: 'Plan retrieved', type: SubscriptionPlanEntity })
  async findByCode(@Param('code') code: string): Promise<SubscriptionPlanEntity> {
    return this.planService.findByCode(code);
  }

  @Patch(':id')
  @RequirePermission('admin:billing')
  @ApiOperation({ summary: 'Update a subscription plan' })
  @ApiBody({ type: UpdateSubscriptionPlanDto })
  @ApiResponse({ status: 200, description: 'Plan updated', type: SubscriptionPlanEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanEntity> {
    return this.planService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('admin:billing')
  @ApiOperation({ summary: 'Delete a subscription plan' })
  async softDelete(@Param('id') id: string): Promise<void> {
    return this.planService.softDelete(id);
  }
}
