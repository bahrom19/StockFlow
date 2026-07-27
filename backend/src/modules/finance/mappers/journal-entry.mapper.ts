import { JournalEntry, JournalLine } from '@prisma/client';
import { JournalEntryEntity } from '../entities/journal-entry.entity';
import { JournalLineEntity } from '../entities/journal-line.entity';

export class JournalLineMapper {
  static toEntity(line: JournalLine): JournalLineEntity {
    return {
      id: line.id,
      journalEntryId: line.journalEntryId,
      accountId: line.accountId,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
      description: line.description,
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
    };
  }

  static toEntityList(lines: JournalLine[]): JournalLineEntity[] {
    return lines.map((l) => this.toEntity(l));
  }
}

type JournalEntryWithLines = JournalEntry & { lines?: JournalLine[] };

export class JournalEntryMapper {
  static toEntity(entry: JournalEntryWithLines): JournalEntryEntity {
    return {
      id: entry.id,
      companyId: entry.companyId,
      financialPeriodId: entry.financialPeriodId,
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate,
      description: entry.description,
      status: entry.status,
      totalDebit: entry.totalDebit.toString(),
      totalCredit: entry.totalCredit.toString(),
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      postedBy: entry.postedBy,
      postedAt: entry.postedAt,
      createdBy: entry.createdBy,
      rowVersion: entry.rowVersion,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      lines: entry.lines
        ? JournalLineMapper.toEntityList(entry.lines)
        : undefined,
    };
  }

  static toEntityList(entries: JournalEntryWithLines[]): JournalEntryEntity[] {
    return entries.map((e) => this.toEntity(e));
  }
}
