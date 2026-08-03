import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PrismaBaseRepository } from '../../infrastructure/repositories/base-prisma.repository';
import { AuditLogService } from './services/audit-log.service';
import { DocumentSequenceService } from './services/document-sequence.service';

@Module({
  providers: [
    PrismaService,
    PrismaBaseRepository,
    AuditLogService,
    DocumentSequenceService,
  ],
  exports: [
    PrismaService,
    PrismaBaseRepository,
    AuditLogService,
    DocumentSequenceService,
  ],
})
export class SharedModule {}
