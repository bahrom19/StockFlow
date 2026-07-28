import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LoyaltyRepository } from '../repositories/loyalty.repository';
import { LoyaltyMapper } from '../mappers/loyalty.mapper';
import { LoyaltyAccountEntity } from '../entities/loyalty-account.entity';
import {
  EarnPointsDto,
  RedeemPointsDto,
  LoyaltyQueryDto,
} from '../dto/loyalty.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CustomerLoyaltyUpdatedEvent } from '../events/customer-loyalty-updated.event';

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly mapper: LoyaltyMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async getOrCreateAccount(
    customerId: string,
    companyId: string,
    userId: string,
  ): Promise<LoyaltyAccountEntity> {
    let account = await this.repository.findByCustomerId(customerId);
    if (!account) {
      account = await this.repository.create({
        points: 0,
        lifetimePoints: 0,
        tier: 'STANDARD',
        enrolledAt: new Date(),
        customer: { connect: { id: customerId } },
      });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'LoyaltyAccount',
        entityId: account.id,
        action: 'CREATE',
        before: null,
        after: account,
      });
    }
    return this.mapper.toEntity(account);
  }

  async getAccount(customerId: string): Promise<LoyaltyAccountEntity> {
    const account = await this.repository.findByCustomerIdOrThrow(customerId);
    return this.mapper.toEntity(account);
  }

  async earnPoints(
    dto: EarnPointsDto,
    companyId: string,
    userId: string,
  ): Promise<LoyaltyAccountEntity> {
    return this.prisma.$transaction(async (tx) => {
      const account = await this.repository.findByCustomerIdOrThrow(
        dto.customerId,
      );
      const pointsBefore = account.points;
      const updated = await this.repository.update({
        id: account.id,
        data: {
          points: account.points + dto.points,
          lifetimePoints: account.lifetimePoints + dto.points,
          lastActivity: new Date(),
        },
        tx,
      });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'LoyaltyAccount',
        entityId: account.id,
        action: 'UPDATE',
        before: account,
        after: updated,
      });
      await this.eventBus.publish(
        new CustomerLoyaltyUpdatedEvent(
          dto.customerId,
          companyId,
          pointsBefore,
          updated.points,
          'EARNED',
          dto.referenceId,
          tx,
        ),
      );
      return this.mapper.toEntity(updated);
    });
  }

  async redeemPoints(
    dto: RedeemPointsDto,
    companyId: string,
    userId: string,
  ): Promise<LoyaltyAccountEntity> {
    return this.prisma.$transaction(async (tx) => {
      const account = await this.repository.findByCustomerIdOrThrow(
        dto.customerId,
      );
      if (account.points < dto.points) {
        throw new BadRequestException('Insufficient loyalty points');
      }
      const pointsBefore = account.points;
      const updated = await this.repository.update({
        id: account.id,
        data: {
          points: account.points - dto.points,
          lastActivity: new Date(),
        },
        tx,
      });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'LoyaltyAccount',
        entityId: account.id,
        action: 'UPDATE',
        before: account,
        after: updated,
      });
      await this.eventBus.publish(
        new CustomerLoyaltyUpdatedEvent(
          dto.customerId,
          companyId,
          pointsBefore,
          updated.points,
          'REDEEMED',
          dto.referenceId,
          tx,
        ),
      );
      return this.mapper.toEntity(updated);
    });
  }

  async getTransactions(accountId: string, query: LoyaltyQueryDto) {
    const { page = 1, limit = 20 } = query;
    return { items: [], total: 0, page, limit };
  }
}
