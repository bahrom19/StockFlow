import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Document types that use the atomic per-company numbering.
 */
export const DocumentSequenceType = {
  SALE: 'SALE',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
} as const;

export type DocumentSequenceTypeValue =
  (typeof DocumentSequenceType)[keyof typeof DocumentSequenceType];

/**
 * Atomic per-company document numbering.
 *
 * Replaces the racy `count + 1` and `Date.now()` generators (M2): two parallel
 * requests used to compute the same next number and one failed with a P2002
 * unique violation (surfaced as HTTP 400). `nextNumber()` consumes a value via
 * a single `INSERT ... ON CONFLICT DO UPDATE` (Prisma `upsert` with an atomic
 * `increment`), so concurrent callers always receive distinct numbers and the
 * collision class is eliminated at the source.
 */
@Injectable()
export class DocumentSequenceService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Atomically consume and return the next document number for a company.
   * Optionally scoped to the caller's transaction via `tx`.
   */
  async nextNumber(
    companyId: string,
    type: DocumentSequenceTypeValue | string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prismaService;
    const seq = await client.documentSequence.upsert({
      where: { companyId_type: { companyId, type } },
      create: { companyId, type, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return seq.lastNumber;
  }
}
