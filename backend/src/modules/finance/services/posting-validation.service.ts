import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface PostingValidationInput {
  companyId: string;
  entryDate: Date;
  financialPeriodId: string;
  lines: Array<{
    accountId: string;
    debit: string;
    credit: string;
    description?: string;
  }>;
}

@Injectable()
export class PostingValidationService {
  /**
   * Validate a journal entry before posting.
   * Throws BadRequestException for any validation failure.
   */
  async validate(
    input: PostingValidationInput,
    tx: Prisma.TransactionClient,
  ): Promise<{ totalDebit: Decimal; totalCredit: Decimal }> {
    // 1. Validate financial period exists and is OPEN
    const period = await tx.financialPeriod.findFirst({
      where: { id: input.financialPeriodId, companyId: input.companyId },
    });
    if (!period) {
      throw new BadRequestException('Financial period not found');
    }
    if (period.status !== 'OPEN') {
      throw new BadRequestException(
        `Cannot post to period "${period.name}". Status is "${period.status}". Only OPEN periods accept postings.`,
      );
    }

    // 2. Validate entry date falls within the period
    if (
      input.entryDate < period.startDate ||
      input.entryDate > period.endDate
    ) {
      throw new BadRequestException(
        `Entry date ${input.entryDate.toISOString()} is outside the period ${period.startDate.toISOString()} — ${period.endDate.toISOString()}`,
      );
    }

    // 3. Validate at least 2 lines
    if (!input.lines || input.lines.length < 2) {
      throw new BadRequestException('Journal entry must have at least 2 lines');
    }

    // 4. Validate all accounts exist, are active, and belong to the company
    const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
    const accounts = await tx.chartOfAccount.findMany({
      where: {
        id: { in: accountIds },
        companyId: input.companyId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (accounts.length !== accountIds.length) {
      const foundIds = new Set(accounts.map((a) => a.id));
      const missingIds = accountIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Accounts not found or inactive: ${missingIds.join(', ')}`,
      );
    }

    // 5. Validate no line has both debit and credit zero
    for (const line of input.lines) {
      const debit = new Decimal(line.debit || '0');
      const credit = new Decimal(line.credit || '0');
      if (debit.isZero() && credit.isZero()) {
        throw new BadRequestException(
          'Each journal line must have a debit or credit amount',
        );
      }
    }

    // 6. Validate debit equals credit
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of input.lines) {
      totalDebit = totalDebit.add(new Decimal(line.debit || '0'));
      totalCredit = totalCredit.add(new Decimal(line.credit || '0'));
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal entry is unbalanced: debit=${totalDebit.toFixed(4)}, credit=${totalCredit.toFixed(4)}`,
      );
    }

    // 7. Validate amounts are not negative
    if (totalDebit.lessThan(0) || totalCredit.lessThan(0)) {
      throw new BadRequestException('Journal line amounts cannot be negative');
    }

    return { totalDebit, totalCredit };
  }
}
