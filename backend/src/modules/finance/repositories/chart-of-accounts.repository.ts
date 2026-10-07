import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ChartOfAccount } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

// Scalar field names of the ChartOfAccount model — used to separate scalar
// updates from relation writes in update() because updateMany accepts only
// scalar fields (ChartOfAccountUpdateManyMutationInput).
const CHART_OF_ACCOUNT_SCALAR_KEYS = new Set<string>(
  Object.values(Prisma.ChartOfAccountScalarFieldEnum),
);

@Injectable()
export class ChartOfAccountsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }

  async create(
    data: Prisma.ChartOfAccountCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ChartOfAccount> {
    return this.prisma(tx).chartOfAccount.create({ data });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ChartOfAccount | null> {
    return this.prisma(tx).chartOfAccount.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    accountType?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ items: ChartOfAccount[]; total: number }> {
    const {
      companyId,
      search,
      accountType,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.ChartOfAccountWhereInput = {
      companyId,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(accountType
        ? { accountType: accountType as Prisma.EnumAccountTypeFilter['equals'] }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Record<string, string> = {};
    orderBy[sortBy || 'createdAt'] = sortOrder || 'desc';

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.chartOfAccount.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.chartOfAccount.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.ChartOfAccountUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
    /**
     * G16-FU-2 — optional extra predicates merged into the SAME `updateMany`
     * that performs the optimistic-locked write.
     *
     * This exists so a guard can participate in the atomic write predicate
     * instead of being evaluated by a preceding SELECT. A separate
     * "SELECT then UPDATE" would leave a TOCTOU window in which a concurrent
     * posting could commit a JournalLine between the check and the write.
     * Merging the predicate means "the account has no journal lines" and "the
     * row still matches the CAS" are decided by one statement.
     *
     * Callers only pass constraints they are willing to have enforced
     * atomically; omitting it preserves the previous behaviour exactly.
     */
    extraWhere?: Prisma.ChartOfAccountWhereInput,
  ): Promise<ChartOfAccount> {
    const prisma = this.prisma(tx);

    // updateMany only accepts scalar fields
    // (ChartOfAccountUpdateManyMutationInput). Relation writes (e.g.
    // parent: { connect }) must be applied via chartOfAccount.update after the
    // optimistic-lock check succeeds, otherwise Prisma throws
    // "Unknown argument `parent`" (Blocker B1 pattern).
    const scalarData: Record<string, unknown> = {};
    const relationData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (CHART_OF_ACCOUNT_SCALAR_KEYS.has(key)) {
        scalarData[key] = value;
      } else {
        relationData[key] = value;
      }
    }

    const result = await prisma.chartOfAccount.updateMany({
      where: {
        // G16-FU-2 defence-in-depth: `extraWhere` is spread FIRST so the
        // authoritative tenant / optimistic-lock / not-deleted predicates below
        // always win on key collision. `extraWhere` is typed
        // `ChartOfAccountWhereInput`, which exposes all of these keys, so
        // spreading it last would let a caller silently replace the tenant
        // scope or the CAS value.
        ...(extraWhere ?? {}),
        id,
        companyId,
        rowVersion,
        deletedAt: null,
      },
      data: { ...scalarData, rowVersion: { increment: 1 } },
    });

    if (result.count === 0) {
      const existing = await prisma.chartOfAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Chart of account not found');
      throw new ConflictException(
        'Chart of account was modified by another user',
      );
    }

    // Apply relation writes (updateMany cannot touch relations).
    // G16-B-02 PH1 (B02-06): Prisma update() requires a unique where clause,
    // so company scope is proven here with a scoped re-assertion in the same
    // transaction instead: the CAS above already gated on {id, companyId,
    // rowVersion} and companyId is immutable, and the connected parent id
    // itself is ownership-validated service-side before this call.
    if (Object.keys(relationData).length > 0) {
      const owned = await prisma.chartOfAccount.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!owned)
        throw new NotFoundException('Chart of account not found');
      await prisma.chartOfAccount.update({ where: { id }, data: relationData });
    }

    return prisma.chartOfAccount.findFirst({
      where: { id, companyId },
    }) as unknown as ChartOfAccount;
  }

  /**
   * G16-FU-3 — undo a soft delete.
   *
   * The CAS predicate requires `deletedAt IS NOT NULL`, so restore can only ever
   * act on a row that is CURRENTLY soft-deleted; an already-live row matches
   * nothing and is reported by the caller as an explicit failure rather than a
   * silent no-op. companyId / id / rowVersion are authoritative and cannot be
   * overridden — there is deliberately no extraWhere parameter on this method.
   *
   * Only `deletedAt` and `isActive` are written. Code, accountType,
   * normalBalance, isCashOrBank and parentId are untouched, and no JournalLine
   * or AccountBalance row is read or modified. The unique (companyId, code)
   * constraint cannot be violated because the same row still holds the code.
   */
  async restore(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ChartOfAccount> {
    const prisma = this.prisma(tx);
    const result = await prisma.chartOfAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: { not: null } },
      data: { deletedAt: null, isActive: true, rowVersion: { increment: 1 } },
    });

    if (result.count === 0) {
      const existing = await prisma.chartOfAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Chart of account not found');
      throw new ConflictException(
        'Chart of account was modified by another user',
      );
    }

    return prisma.chartOfAccount.findFirst({
      where: { id, companyId },
    }) as unknown as ChartOfAccount;
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ChartOfAccount> {
    const prisma = this.prisma(tx);
    const result = await prisma.chartOfAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        isActive: false,
        rowVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const existing = await prisma.chartOfAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Chart of account not found');
      throw new ConflictException(
        'Chart of account was modified by another user',
      );
    }

    return prisma.chartOfAccount.findFirst({
      where: { id },
    }) as unknown as ChartOfAccount;
  }
}
