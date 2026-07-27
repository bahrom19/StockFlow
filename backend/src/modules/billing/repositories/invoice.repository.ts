import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Invoice, InvoiceLine, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

const invoiceInclude = { lines: { orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class InvoiceRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(data: Prisma.InvoiceCreateInput, tx?: Prisma.TransactionClient): Promise<Invoice & { lines?: InvoiceLine[] }> {
    return this.getClient(tx).invoice.create({ data, include: invoiceInclude });
  }

  async findById(id: string, companyId: string, tx?: Prisma.TransactionClient): Promise<(Invoice & { lines?: InvoiceLine[] }) | null> {
    return this.getClient(tx).invoice.findFirst({
      where: { id, companyId, deletedAt: null },
      include: invoiceInclude,
    });
  }

  async findBySubscription(subscriptionId: string, companyId: string, tx?: Prisma.TransactionClient): Promise<(Invoice & { lines?: InvoiceLine[] })[]> {
    return this.getClient(tx).invoice.findMany({
      where: { subscriptionId, companyId, deletedAt: null },
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(params: {
    companyId: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: (Invoice & { lines?: InvoiceLine[] })[]; total: number }> {
    const {
      companyId, status, dateFrom, dateTo,
      page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc',
    } = params;

    const where: Prisma.InvoiceWhereInput = { companyId, deletedAt: null };
    if (status) where.status = status as InvoiceStatus;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.invoice.findMany({
        where, include: invoiceInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prismaService.invoice.count({ where }),
    ]);
    return { items, total };
  }

  async update(
    id: string, data: Prisma.InvoiceUpdateInput, companyId: string,
    rowVersion?: number, tx?: Prisma.TransactionClient,
  ): Promise<Invoice & { lines?: InvoiceLine[] }> {
    const client = this.getClient(tx);
    if (rowVersion !== undefined) {
      const result = await client.invoice.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });
      if (result.count === 0) {
        const existing = await client.invoice.findFirst({ where: { id, companyId } });
        if (!existing) throw new NotFoundException(`Invoice ${id} not found`);
        throw new ConflictException(`Invoice ${id} was modified by another user`);
      }
      return client.invoice.findUnique({ where: { id }, include: invoiceInclude }) as unknown as Invoice & { lines?: InvoiceLine[] };
    }
    const existing = await this.findById(id, companyId, tx);
    if (!existing) throw new NotFoundException(`Invoice ${id} not found`);
    return client.invoice.update({ where: { id }, data, include: invoiceInclude });
  }

  async softDelete(id: string, companyId: string, rowVersion?: number, tx?: Prisma.TransactionClient): Promise<Invoice & { lines?: InvoiceLine[] }> {
    return this.update(id, { deletedAt: new Date() }, companyId, rowVersion, tx);
  }

  async getNextInvoiceNumber(companyId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    // Use millisecond timestamp suffix to prevent race conditions under concurrent invoice generation.
    // The invoiceNumber is @unique in the schema, so duplicate writes will fail with
    // a unique constraint violation and roll back the transaction.
    // TODO: Replace with PostgreSQL sequence (SELECT nextval('invoice_number_seq')) via raw SQL
    // migration for proper gapless sequential numbering usable by accounting.
    const ms = Date.now().toString(36).slice(-6).toUpperCase();
    return `INV-${dateStr}-${ms}`;
  }
}
