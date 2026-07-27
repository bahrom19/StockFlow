import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanySubscription, Currency, PaymentTransactionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import { InvoiceQueryDto } from '../dto/invoice-query.dto';
import { InvoiceEntity } from '../entities/invoice.entity';
import { InvoiceMapper } from '../mappers/invoice.mapper';
import { InvoiceGeneratedEvent } from '../events/invoice-generated.event';
import { PaymentSucceededEvent } from '../events/payment-succeeded.event';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly subscriptionRepository: CompanySubscriptionRepository,
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly prismaService: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async findAll(
    query: InvoiceQueryDto,
    companyId: string,
  ): Promise<{ items: InvoiceEntity[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1) throw new BadRequestException('Page and limit must be positive');

    const result = await this.invoiceRepository.findAll({
      companyId,
      status: query.status,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: InvoiceMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, companyId: string): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(id, companyId);
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return InvoiceMapper.toEntity(invoice);
  }

  async generateInvoice(
    subscriptionId: string,
    companyId: string,
    userId: string,
  ): Promise<InvoiceEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const subRecord = await this.subscriptionRepository.findById(subscriptionId, companyId, tx);
      if (!subRecord) throw new NotFoundException('Subscription not found');

      const invoiceNumber = await this.invoiceRepository.getNextInvoiceNumber(companyId, tx);
      const subData = subRecord as unknown as CompanySubscription & { plan: { priceMonthly: Prisma.Decimal; currency: string; name: string } };
      const plan = subData.plan as { priceMonthly: Prisma.Decimal; currency: string; name: string };
      const totalAmount = plan.priceMonthly;

      const invoice = await this.invoiceRepository.create({
        company: { connect: { id: companyId } },
        subscription: { connect: { id: subscriptionId } },
        invoiceNumber,
        status: 'PENDING',
        subtotal: totalAmount,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount,
        paidAmount: 0,
        currency: plan.currency as Currency,
        dueDate: subData.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lines: {
          create: [{
            description: `${plan.name} plan - Monthly subscription`,
            quantity: 1,
            unitPrice: totalAmount,
            discountAmount: 0,
            taxAmount: 0,
            total: totalAmount,
          }],
        },
      }, tx);

      await this.eventBus.publish(
        new InvoiceGeneratedEvent({
          companyId,
          invoiceId: invoice.id,
          invoiceNumber,
          amount: totalAmount.toString(),
          dueDate: invoice.dueDate?.toISOString() ?? '',
        }),
        { context: { transactionClient: tx } },
      );

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_GENERATED',
          entity: 'Invoice',
          entityId: invoice.id,
          newValues: { invoiceNumber, amount: totalAmount.toString(), status: 'PENDING' },
          companyId,
          userId: userId ?? null,
        },
      });

      return InvoiceMapper.toEntity(invoice);
    });
  }

  async markPaid(
    id: string,
    companyId: string,
    paidAmount: string,
    providerInvoiceId?: string,
  ): Promise<InvoiceEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const invoice = await this.invoiceRepository.findById(id, companyId, tx);
      if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
      if (invoice.status !== 'PENDING') {
        throw new BadRequestException(`Invoice ${id} is not pending`);
      }

      const rowVer = invoice.rowVersion ?? 0;
      const updated = await this.invoiceRepository.update(
        id,
        {
          status: 'PAID',
          paidAt: new Date(),
          paidAmount: paidAmount,
          providerInvoiceId: providerInvoiceId ?? invoice.providerInvoiceId,
        },
        companyId,
        rowVer,
        tx,
      );

      // Create payment transaction record
      await this.paymentTransactionRepository.create({
        company: { connect: { id: companyId } },
        subscription: { connect: { id: invoice.subscriptionId } },
        invoice: { connect: { id } },
        amount: paidAmount,
        currency: invoice.currency as Currency,
        status: 'SUCCEEDED' as PaymentTransactionStatus,
        method: providerInvoiceId ? 'card' : 'manual',
        providerPaymentId: providerInvoiceId ?? null,
        reference: `Payment for invoice ${invoice.invoiceNumber}`,
      }, tx);

      await this.eventBus.publish(
        new PaymentSucceededEvent({
          companyId,
          invoiceId: id,
          amount: paidAmount,
          currency: invoice.currency,
          provider: providerInvoiceId ? 'stripe' : 'manual',
        }),
        { context: { transactionClient: tx } },
      );

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_PAID',
          entity: 'Invoice',
          entityId: id,
          oldValues: { status: 'PENDING', rowVersion: invoice.rowVersion },
          newValues: { status: 'PAID', paidAmount, providerInvoiceId },
          companyId,
          userId: null,
        },
      });

      return InvoiceMapper.toEntity(updated);
    });
  }

  async voidInvoice(id: string, companyId: string): Promise<InvoiceEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const invoice = await this.invoiceRepository.findById(id, companyId, tx);
      if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
      if (invoice.status !== 'PENDING') {
        throw new BadRequestException('Only pending invoices can be voided');
      }

      const rowVer = invoice.rowVersion ?? 0;
      const updated = await this.invoiceRepository.update(
        id,
        { status: 'CANCELLED' },
        companyId,
        rowVer,
        tx,
      );

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_VOIDED',
          entity: 'Invoice',
          entityId: id,
          oldValues: { status: invoice.status, invoiceNumber: invoice.invoiceNumber },
          newValues: { status: 'CANCELLED' },
          companyId,
          userId: null,
        },
      });

      return InvoiceMapper.toEntity(updated);
    });
  }
}
