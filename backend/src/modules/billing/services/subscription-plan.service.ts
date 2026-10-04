import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { SubscriptionPlanRepository } from '../repositories/subscription-plan.repository';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from '../dto/update-subscription-plan.dto';
import { SubscriptionPlanQueryDto } from '../dto/subscription-plan-query.dto';
import { SubscriptionPlanEntity } from '../entities/subscription-plan.entity';
import { SubscriptionPlanMapper } from '../mappers/subscription-plan.mapper';

@Injectable()
export class SubscriptionPlanService {
  constructor(
    private readonly planRepository: SubscriptionPlanRepository,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * G16-N-4 P0-A: SubscriptionPlan is a GLOBAL resource. `companyId` is
   * therefore `string | null` and the controller passes `null`, so a global
   * plan mutation is never attributed to a tenant. The actor `userId` is
   * still recorded.
   */
  async create(
    dto: CreateSubscriptionPlanDto,
    companyId: string | null,
    userId: string,
  ): Promise<SubscriptionPlanEntity> {
    const existing = await this.planRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(`Plan with code ${dto.code} already exists`);
    }

    const data: Prisma.SubscriptionPlanCreateInput = {
      code: dto.code,
      name: dto.name,
      description: dto.description,
      priceMonthly: dto.priceMonthly,
      priceYearly: dto.priceYearly,
      currency: (dto.currency ?? 'USD') as Currency,
      trialDays: dto.trialDays ?? 14,
      maxUsers: dto.maxUsers ?? 3,
      maxWarehouses: dto.maxWarehouses ?? 1,
      maxProducts: dto.maxProducts ?? 500,
      featureFlags: (dto.featureFlags ??
        {}) as unknown as Prisma.InputJsonValue,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    };

    const plan = await this.planRepository.create(data);
    await this.prismaService.auditLog.create({
      data: {
        action: 'PLAN_CREATED',
        entity: 'SubscriptionPlan',
        entityId: plan.id,
        newValues: {
          code: plan.code,
          name: plan.name,
          priceMonthly: plan.priceMonthly.toString(),
        },
        companyId,
        userId,
      },
    });
    return SubscriptionPlanMapper.toEntity(plan);
  }

  async findAll(query: SubscriptionPlanQueryDto): Promise<{
    items: SubscriptionPlanEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

    const result = await this.planRepository.findAll({
      search: query.search,
      isActive: query.isActive,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: SubscriptionPlanMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<SubscriptionPlanEntity> {
    const plan = await this.planRepository.findById(id);
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return SubscriptionPlanMapper.toEntity(plan);
  }

  async findByCode(code: string): Promise<SubscriptionPlanEntity> {
    const plan = await this.planRepository.findByCode(code);
    if (!plan) throw new NotFoundException(`Plan ${code} not found`);
    return SubscriptionPlanMapper.toEntity(plan);
  }

  /** G16-N-4 P0-A: see create() — `companyId` is null for global plans. */
  async update(
    id: string,
    dto: UpdateSubscriptionPlanDto,
    companyId: string | null,
    userId: string,
  ): Promise<SubscriptionPlanEntity> {
    const existing = await this.planRepository.findById(id);
    if (!existing) throw new NotFoundException(`Plan ${id} not found`);

    const data: Prisma.SubscriptionPlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priceMonthly !== undefined) data.priceMonthly = dto.priceMonthly;
    if (dto.priceYearly !== undefined) data.priceYearly = dto.priceYearly;
    if (dto.currency !== undefined) data.currency = dto.currency as Currency;
    if (dto.trialDays !== undefined) data.trialDays = dto.trialDays;
    if (dto.maxUsers !== undefined) data.maxUsers = dto.maxUsers;
    if (dto.maxWarehouses !== undefined) data.maxWarehouses = dto.maxWarehouses;
    if (dto.maxProducts !== undefined) data.maxProducts = dto.maxProducts;
    if (dto.featureFlags !== undefined)
      data.featureFlags = dto.featureFlags as unknown as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const rowVer = existing.rowVersion ?? 0;
    const updated = await this.planRepository.update(id, data, rowVer);
    await this.prismaService.auditLog.create({
      data: {
        action: 'PLAN_UPDATED',
        entity: 'SubscriptionPlan',
        entityId: id,
        oldValues: { name: existing.name },
        newValues: { name: updated.name },
        companyId,
        userId,
      },
    });
    return SubscriptionPlanMapper.toEntity(updated);
  }

  /**
   * G16-N-4 P0-A: the global plan deletion is now audited.
   *
   * Previously this method took no actor and wrote no audit row, so a tenant
   * administrator holding `admin:billing` could soft-delete a global plan with
   * no attribution whatsoever. The PLAN_DELETED row carries the resource
   * identity (code + name) needed to reconstruct what was removed, and
   * `companyId: null` because a global plan has no owning tenant.
   */
  async softDelete(id: string, userId: string): Promise<void> {
    const existing = await this.planRepository.findById(id);
    if (!existing) throw new NotFoundException(`Plan ${id} not found`);
    const rowVer = existing.rowVersion ?? 0;
    await this.planRepository.softDelete(id, rowVer);
    await this.prismaService.auditLog.create({
      data: {
        action: 'PLAN_DELETED',
        entity: 'SubscriptionPlan',
        entityId: id,
        oldValues: {
          code: existing.code,
          name: existing.name,
          priceMonthly: existing.priceMonthly.toString(),
          priceYearly: existing.priceYearly.toString(),
          currency: existing.currency,
          isActive: existing.isActive,
        },
        companyId: null,
        userId,
      },
    });
  }
}
