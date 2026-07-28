import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PrismaBaseRepository } from '../../infrastructure/repositories/base-prisma.repository';
import { AuditLogService } from './services/audit-log.service';

@Module({
  providers: [
    PrismaService,
    PrismaBaseRepository,
    AuditLogService,
  ],
  exports: [PrismaService, PrismaBaseRepository, AuditLogService],
})
export class SharedModule {}
