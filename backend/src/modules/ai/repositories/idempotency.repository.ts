import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

export type IdempotencyStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  id: string;
  companyId: string;
  userId: string;
  conversationId: string | null;
  idempotencyKey: string;
  requestFingerprint: string;
  status: string;
  responsePayload: any;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface AcquireLockResult {
  acquired: boolean;
  record?: IdempotencyRecord;
}

/**
 * IdempotencyRepository — data access for AI idempotency requests.
 *
 * Provides atomic operations for idempotency key management:
 * - Acquire lock (INSERT with UNIQUE handling)
 * - Update status (COMPLETED/FAILED)
 * - Reclaim expired PENDING records
 * - Find existing records
 *
 * SECURITY:
 * - All queries scoped by companyId + userId
 * - No cross-tenant access possible
 */
@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  /**
   * Find an idempotency record by key.
   * Scoped to companyId + userId.
   */
  async findByKey(
    companyId: string,
    userId: string,
    idempotencyKey: string,
    tx?: Prisma.TransactionClient,
  ): Promise<IdempotencyRecord | null> {
    const client = this.getClient(tx);
    const result = await client.aiIdempotencyRequest.findFirst({
      where: {
        companyId,
        userId,
        idempotencyKey,
      },
    });
    return result as IdempotencyRecord | null;
  }

  /**
   * Acquire idempotency lock by inserting a PENDING record.
   *
   * Uses INSERT with UNIQUE constraint to ensure only one request
   * can proceed with a given idempotency key.
   *
   * @returns AcquireLockResult with acquired flag and existing record if conflict
   */
  async acquireLock(
    companyId: string,
    userId: string,
    conversationId: string | null,
    idempotencyKey: string,
    requestFingerprint: string,
    ttlMs: number = 5 * 60 * 1000, // 5 minutes default
    tx?: Prisma.TransactionClient,
  ): Promise<AcquireLockResult> {
    const client = this.getClient(tx);
    try {
      // Try to INSERT new PENDING record
      const createData: any = {
        companyId,
        userId,
        idempotencyKey,
        requestFingerprint,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + ttlMs),
      };
      
      // Only include conversationId if it's not null
      if (conversationId !== null) {
        createData.conversationId = conversationId;
      }
      
      const record = await client.aiIdempotencyRequest.create({
        data: createData,
      });

      return { acquired: true, record: record as IdempotencyRecord };
    } catch (error) {
      // Handle UNIQUE violation (P2002) - re-throw to allow caller to handle
      // DO NOT do SELECT within same transaction after P2002
      throw error;
    }
  }

  /**
   * Update conversationId for an idempotency record.
   * Used to link conversation after creation.
   */
  async updateConversationId(
    companyId: string,
    userId: string,
    idempotencyKey: string,
    conversationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.getClient(tx);
    await client.aiIdempotencyRequest.updateMany({
      where: {
        companyId,
        userId,
        idempotencyKey,
        status: 'PENDING',
      },
      data: {
        conversationId,
      },
    });
  }

  /**
   * Update idempotency record status to COMPLETED.
   *
   * Stores the exact response payload and extends TTL to 24 hours.
   */
  async updateCompleted(
    companyId: string,
    userId: string,
    idempotencyKey: string,
    responsePayload: Record<string, unknown>,
  ): Promise<void> {
    await this.prismaService.aiIdempotencyRequest.updateMany({
      where: {
        companyId,
        userId,
        idempotencyKey,
        status: 'PENDING',
      },
      data: {
        status: 'COMPLETED',
        responsePayload: responsePayload as any,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
  }

  /**
   * Update idempotency record status to FAILED.
   *
   * Stores the error response payload and extends TTL to 24 hours.
   */
  async updateFailed(
    companyId: string,
    userId: string,
    idempotencyKey: string,
    responsePayload: Record<string, unknown>,
  ): Promise<void> {
    await this.prismaService.aiIdempotencyRequest.updateMany({
      where: {
        companyId,
        userId,
        idempotencyKey,
        status: 'PENDING',
      },
      data: {
        status: 'FAILED',
        responsePayload: responsePayload as any,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
  }

  /**
   * Attempt to reclaim an expired PENDING record.
   *
   * Uses atomic DELETE with conditions to ensure only stale records
   * are deleted and only one request can reclaim.
   *
   * @returns true if record was reclaimed, false if already reclaimed by another request
   */
  async reclaimExpired(
    companyId: string,
    userId: string,
    idempotencyKey: string,
    recordId: string,
  ): Promise<boolean> {
    const result = await this.prismaService.aiIdempotencyRequest.deleteMany({
      where: {
        id: recordId,
        companyId,
        userId,
        idempotencyKey,
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
    });

    return result.count > 0;
  }

  /**
   * Delete an idempotency record.
   * Used for cleanup and error handling.
   */
  async delete(
    companyId: string,
    userId: string,
    idempotencyKey: string,
  ): Promise<void> {
    await this.prismaService.aiIdempotencyRequest.deleteMany({
      where: {
        companyId,
        userId,
        idempotencyKey,
      },
    });
  }

  /**
   * Delete expired idempotency records.
   * Used by cleanup job.
   */
  async deleteExpired(): Promise<number> {
    const result = await this.prismaService.aiIdempotencyRequest.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}
