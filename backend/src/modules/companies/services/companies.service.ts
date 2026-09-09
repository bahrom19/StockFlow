import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { UpdateCompanyCurrencyDto } from '../dto/update-company-currency.dto';
import { CompanyCurrencyResponseDto } from '../dto/company-currency.response.dto';

/** Tables whose existence blocks currency change (implicit Company.currency). */
const LOCK_TABLES = [
  'Product',
  'CostLayer',
  'Sale',
  'PurchaseOrder',
  'PurchaseReturn',
  'PurchaseInvoice',
  'CashShift',
  'CashAccount',
  'BankAccount',
  'FinancialTransaction',
  'SupplierPayment',
  'SupplierProduct',
  'CreditLimit',
] as const;

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ── GET /companies/me ────────────────────────────────────────

  async getCompanyCurrency(
    companyId: string,
  ): Promise<CompanyCurrencyResponseDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, currency: true, name: true },
    });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }
    return {
      companyId: company.id,
      currency: company.currency,
      companyName: company.name,
    };
  }

  // ── PATCH /companies/me ──────────────────────────────────────

  async updateCurrency(
    companyId: string,
    dto: UpdateCompanyCurrencyDto,
    userId: string,
  ): Promise<CompanyCurrencyResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock Company row — serializes concurrent PATCH requests
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, currency: true, name: true },
      });
      if (!company) {
        throw new NotFoundException(`Company ${companyId} not found`);
      }

      // Force row-level lock via raw query (Prisma findUnique doesn't support
      // FOR UPDATE directly). This ensures concurrent PATCH requests serialize.
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;

      // 2. Check: does any monetary data exist?
      //    All 13 tables checked atomically within the transaction.
      //    The FOR UPDATE lock on Company prevents a concurrent PATCH from
      //    committing between our check and update.
      const hasMonetaryData = await this.checkMonetaryDataExists(tx, companyId);
      if (hasMonetaryData) {
        throw new BadRequestException(
          'Cannot change currency: company has existing financial data',
        );
      }

      // 3. Update currency
      await tx.company.update({
        where: { id: companyId },
        data: { currency: dto.currency },
      });

      // 4. Audit log (inside same transaction)
      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'Company',
          entityId: companyId,
          action: 'CURRENCY_CHANGED',
          before: { currency: company.currency },
          after: { currency: dto.currency },
        },
        tx,
      );

      return {
        companyId,
        currency: dto.currency,
        companyName: company.name,
      };
    });
  }

  // ── Shared helper for other services ─────────────────────────

  /**
   * Returns the company's base currency. Used by create/update services
   * to enforce `document.currency == Company.currency`.
   */
  async getBaseCurrency(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { currency: true },
    });
    return (company?.currency as string) ?? 'KZT';
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Checks if ANY of the 13 lock-tables has records for this company.
   * Uses EXISTS for efficiency — stops at first match.
   */
  private async checkMonetaryDataExists(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<boolean> {
    const checks = LOCK_TABLES.map(
      (table) =>
        Prisma.sql`SELECT EXISTS(SELECT 1 FROM ${Prisma.raw(`"${table}"`)} WHERE "companyId" = ${companyId} LIMIT 1)`,
    );

    // Run all EXISTS checks — any true means data exists
    for (const check of checks) {
      const result = await tx.$queryRaw<{ exists: boolean }[]>(check);
      if (result[0]?.exists) {
        return true;
      }
    }
    return false;
  }
}
