import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, NormalBalance, Prisma } from '@prisma/client';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateChartOfAccountDto } from '../dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from '../dto/update-chart-of-account.dto';
import { ChartOfAccountQueryDto } from '../dto/chart-of-account-query.dto';
import { ChartOfAccountEntity } from '../entities/chart-of-account.entity';
import { ChartOfAccountMapper } from '../mappers/chart-of-account.mapper';
import { ChartOfAccountsRepository } from '../repositories/chart-of-accounts.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private readonly repository: ChartOfAccountsRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * G16-FU-2 — the canonical cash-classification invariant, enforced at the
   * WRITE boundary only. `CashFlowService` deliberately stays unchanged and
   * keeps treating `isCashOrBank` as the authoritative cash population.
   *
   * `isCashOrBank === true` requires an ASSET/DEBIT account, because the cash
   * figure is computed as Σ(debit − credit) over that population. The value
   * is never coerced: an invalid combination is rejected outright.
   */
  private assertCashClassification(
    isCashOrBank: boolean,
    accountType: string,
    normalBalance: string,
  ): void {
    if (!isCashOrBank) return;
    if (accountType !== 'ASSET' || normalBalance !== 'DEBIT') {
      throw new BadRequestException(
        `A cash/bank account must be an ASSET with DEBIT normal balance ` +
          `(received accountType=${accountType}, normalBalance=${normalBalance})`,
      );
    }
  }

  async create(
    dto: CreateChartOfAccountDto,
    currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    // G15-07-C1: isSystem is server-controlled. Clients must not be able to
    // create a system account; the persisted value is always forced to false
    // regardless of what the client sent (false, undefined or true-rejected).
    if (dto.isSystem === true) {
      throw new BadRequestException(
        'System accounts cannot be created through the API',
      );
    }

    // G16-FU-2: a cash/bank account must be ASSET/DEBIT. Checked before the
    // row is built so an invalid classification never reaches the database.
    this.assertCashClassification(
      dto.isCashOrBank ?? false,
      dto.accountType as string,
      dto.normalBalance as string,
    );

    const data: Prisma.ChartOfAccountCreateInput = {
      code: dto.code,
      name: dto.name,
      description: dto.description || null,
      accountType: dto.accountType as AccountType,
      normalBalance: dto.normalBalance as NormalBalance,
      isActive: dto.isActive ?? true,
      isSystem: false,
      isCashOrBank: dto.isCashOrBank ?? false,
      parent: dto.parentId ? { connect: { id: dto.parentId } } : undefined,
      level: dto.level ?? 0,
      sortOrder: dto.sortOrder ?? 0,
      company: { connect: { id: currentUser.companyId } },
    };

    const [account] = await this.prismaService.$transaction(async (tx) => {
      // G16-B-02 PH1 (B02-06): parent account must belong to the caller's
      // company (active, non-deleted). Prisma `connect` enforces existence
      // only, never tenant ownership.
      if (dto.parentId) {
        const parent = await tx.chartOfAccount.findFirst({
          where: {
            id: dto.parentId,
            companyId: currentUser.companyId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!parent) throw new NotFoundException('Parent account not found');
      }
      const result = await this.repository.create(data, tx);
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'ChartOfAccount',
          entityId: result.id,
          action: 'CREATE',
          before: null,
          after: result,
        },
        tx,
      );
      return [result];
    });

    return ChartOfAccountMapper.toEntity(account);
  }

  async findAll(
    query: ChartOfAccountQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: ChartOfAccountEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

    const result = await this.repository.findAll({
      companyId: currentUser.companyId,
      search: query.search,
      accountType: query.accountType,
      isActive: query.isActive,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: ChartOfAccountMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    const account = await this.repository.findById(id, currentUser.companyId);
    if (!account) throw new NotFoundException('Chart of account not found');
    return ChartOfAccountMapper.toEntity(account);
  }

  async update(
    id: string,
    dto: UpdateChartOfAccountDto,
    currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Chart of account not found');

    const data: Prisma.ChartOfAccountUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.accountType !== undefined)
      data.accountType = dto.accountType as AccountType;
    if (dto.normalBalance !== undefined)
      data.normalBalance = dto.normalBalance as NormalBalance;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    // G15-07-C1: isSystem is server-controlled. A client may echo the current
    // value (accepted as a no-op) but must never change it, and a
    // client-supplied value is never written.
    if (dto.isSystem !== undefined && dto.isSystem !== before.isSystem) {
      throw new BadRequestException(
        'The system-account flag cannot be changed through the API',
      );
    }
    if (dto.isCashOrBank !== undefined) data.isCashOrBank = dto.isCashOrBank;

    // ── G16-FU-2: cash-classification integrity ────────────────────────
    //
    // `isCashOrBank` is an independent per-account business classification —
    // it is NOT derived from `accountType` (many ASSET accounts are legitimately
    // cash: 1010, 1020, …), and it is NOT derived from the CashAccount /
    // BankAccount sub-domain. What it DOES require is an account capable of
    // representing cash, i.e. an ASSET/DEBIT account: `CashFlowService` computes
    // cash as Σ(debit − credit) over exactly this population, so any other
    // type/normalBalance pair produces a meaningless figure.
    //
    // The final state is validated, not just the supplied field: that closes
    // the cross-direction bypass where a client leaves `isCashOrBank: true` and
    // flips `accountType` or `normalBalance` instead. Such a PATCH is rejected
    // unconditionally — no history involved, because it is invalid at the type
    // level regardless of posting history.
    const finalIsCash =
      dto.isCashOrBank !== undefined ? dto.isCashOrBank : before.isCashOrBank;
    const finalAccountType =
      dto.accountType !== undefined ? dto.accountType : before.accountType;
    const finalNormalBalance =
      dto.normalBalance !== undefined
        ? dto.normalBalance
        : before.normalBalance;
    this.assertCashClassification(
      finalIsCash,
      finalAccountType,
      finalNormalBalance,
    );

    // Historical gate. Cash is an ACCOUNTING HISTORY question (G16 CR-1/CR-4):
    // once an account carries any JournalLine, reclassifying it would silently
    // restate historical cash — including for an account whose current balance
    // happens to be zero, or whose every entry was later reversed. Those
    // JournalLines are exactly the rows the cash-flow movement sections render.
    // Balance, AccountBalance snapshots and period state are deliberately NOT
    // consulted: none of them is a reliable proxy for "has history".
    const cashFlagChanging =
      dto.isCashOrBank !== undefined &&
      dto.isCashOrBank !== before.isCashOrBank;

    if (dto.parentId !== undefined) {
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
    }
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const [updated] = await this.prismaService.$transaction(async (tx) => {
      // G16-B-02 PH1 (B02-06): re-validate supplied parent (see create).
      // Disconnect (explicit null) needs no check.
      if (dto.parentId) {
        const parent = await tx.chartOfAccount.findFirst({
          where: {
            id: dto.parentId,
            companyId: currentUser.companyId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!parent) throw new NotFoundException('Parent account not found');
      }
      // G16-FU-2: the historical gate is threaded into the SAME updateMany that
      // performs the optimistic-locked write, so "no journal history" and "row
      // still matches the CAS" are decided atomically by one statement. A
      // SELECT-then-UPDATE would leave a window in which a concurrent posting
      // commits a JournalLine between the check and the write.
      //
      // The guard is only attached when the cash flag itself is being toggled;
      // a benign rename of a posted cash account must keep working.
      let result;
      try {
        result = await this.repository.update(
          id,
          data,
          currentUser.companyId,
          before.rowVersion,
          tx,
          cashFlagChanging ? { journalLines: { none: {} } } : undefined,
        );
      } catch (e) {
        // Distinguish "row no longer matches the CAS" from "this account has
        // history, so its classification is frozen". This read only picks the
        // error message; enforcement already happened atomically above.
        if (
          cashFlagChanging &&
          e instanceof ConflictException &&
          (await tx.chartOfAccount.count({
            where: { id, companyId: currentUser.companyId },
          })) > 0
        ) {
          const hasHistory = await tx.journalLine.count({
            where: { accountId: id },
          });
          if (hasHistory > 0) {
            throw new BadRequestException(
              'Cash classification cannot be changed after the account has ' +
                'journal history: it would retroactively restate historical ' +
                'cash movements',
            );
          }
        }
        throw e;
      }
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'ChartOfAccount',
          entityId: id,
          action: 'UPDATE',
          before,
          after: result,
        },
        tx,
      );
      return [result];
    });
    return ChartOfAccountMapper.toEntity(updated);
  }

  async softDelete(
    id: string,
    currentUser: JwtPayload,
  ): Promise<ChartOfAccountEntity> {
    const before = await this.repository.findById(id, currentUser.companyId);
    if (!before) throw new NotFoundException('Chart of account not found');

    // G15-07-C1: system accounts are protected from deletion. Soft-deleting a
    // system account would be unrecoverable: the scoped lookups filter
    // deletedAt, so the row becomes invisible to the API while the plain
    // unique (companyId, code) constraint still blocks recreating the code.
    if (before.isSystem) {
      throw new BadRequestException('System accounts cannot be deleted');
    }

    const [deleted] = await this.prismaService.$transaction(async (tx) => {
      const result = await this.repository.softDelete(
        id,
        currentUser.companyId,
        before.rowVersion,
        tx,
      );
      await this.auditLog.log(
        {
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'ChartOfAccount',
          entityId: id,
          action: 'DELETE',
          before,
          after: null,
        },
        tx,
      );
      return [result];
    });
    return ChartOfAccountMapper.toEntity(deleted);
  }
}
