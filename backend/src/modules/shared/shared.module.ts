import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { PrismaBaseRepository } from '../../infrastructure/repositories/base-prisma.repository';
import { AuditLogService } from './services/audit-log.service';

@Module({
  providers: [
    PrismaService,
    RedisService,
    PrismaBaseRepository,
    AuditLogService,
  ],
  exports: [PrismaService, RedisService, PrismaBaseRepository, AuditLogService],
})
export class SharedModule {}
