import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanySubscription,
  Currency,
  PaymentTransactionStatus,
  Prisma,
} from '@prisma/client';
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

/**
 * Result of {@link InvoiceService.generateRecurringInvoice}.
 * `created` is false when the current billing period was already invoiced
 * (idempotent skip — no new invoice, no repeated period advancement).
 */
export interface RecurringInvoiceResult {
  invoice: InvoiceEntity;
  created: boolean;
}

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
  ): Promise<{
    items: InvoiceEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

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
      const subRecord = await this.subscriptionRepository.findById(
        subscriptionId,
        companyId,
        tx,
      );
      if (!subRecord) throw new NotFoundException('Subscription not found');

      const invoiceNumber = await this.invoiceRepository.getNextInvoiceNumber(
        companyId,
        tx,
      );
      const subData = subRecord as unknown as CompanySubscription & {
        plan: { priceMonthly: Prisma.Decimal; currency: string; name: string };
      };
      const plan = subData.plan as {
        priceMonthly: Prisma.Decimal;
        currency: string;
        name: string;
      };
      const totalAmount = plan.priceMonthly;

      const invoice = await this.invoiceRepository.create(
        {
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
          dueDate:
            subData.currentPeriodEnd ??
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lines: {
            create: [
              {
                description: `${plan.name} plan - Monthly subscription`,
                quantity: 1,
                unitPrice: totalAmount,
                discountAmount: 0,
                taxAmount: 0,
                total: totalAmount,
              },
            ],
          },
        },
        tx,
      );

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
          newValues: {
            invoiceNumber,
            amount: totalAmount.toString(),
            status: 'PENDING',
          },
          companyId,
          userId: userId ?? null,
        },
      });

      return InvoiceMapper.toEntity(invoice);
    });
  }

  /**
   * Atomic recurring-invoice generation for the billing cron (G13-03-05).
   *
   * Invoice creation + billing period advancement happen in a SINGLE database
   * transaction, so a crash or a failed period update can never leave a
   * committed invoice behind with an un-advanced period (which the next cron
   * run would invoice a second time).
   *
   * Canonical billing-period identity: the invoice's `dueDate` equals the
   * subscription's `currentPeriodEnd` at generation time. If a live
   * (non-CANCELLED, non-deleted) invoice already covers the current period,
   * no new invoice is created and the period is NOT advanced again
   * (idempotent re-run protection).
   *
   * Concurrency: the period is advanced with the existing `rowVersion`
   * optimistic lock inside the same transaction. A concurrent overlapping
   * execution loses the compare-and-swap check, throws, and rolls back its
   * own invoice insert together with everything else — exactly one invoice
   * per billing period survives.
   */
  async generateRecurringInvoice(
    subscriptionId: string,
    companyId: string,
    userId: string,
  ): Promise<RecurringInvoiceResult> {
    return this.prismaService.$transaction(async (tx) => {
      const subRecord = await this.subscriptionRepository.findById(
        subscriptionId,
        companyId,
        tx,
      );
      if (!subRecord) throw new NotFoundException('Subscription not found');

      const subData = subRecord as unknown as CompanySubscription & {
        plan: { priceMonthly: Prisma.Decimal; currency: string; name: string };
      };
      const periodEnd = subData.currentPeriodEnd ?? null;

      // Idempotency guard: this billing period is already invoiced.
      if (periodEnd) {
        const existing = await tx.invoice.findFirst({
          where: {
            subscriptionId,
            companyId,
            dueDate: periodEnd,
            status: { not: 'CANCELLED' },
            deletedAt: null,
          },
          include: { lines: { orderBy: { createdAt: 'asc' } } },
        });
        if (existing) {
          return { invoice: InvoiceMapper.toEntity(existing), created: false };
        }
      }

      const invoiceNumber = await this.invoiceRepository.getNextInvoiceNumber(
        companyId,
        tx,
      );
      const plan = subData.plan as {
        priceMonthly: Prisma.Decimal;
        currency: string;
        name: string;
      };
      const totalAmount = plan.priceMonthly;

      const invoice = await this.invoiceRepository.create(
        {
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
          dueDate:
            subData.currentPeriodEnd ??
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lines: {
            create: [
              {
                description: `${plan.name} plan - Monthly subscription`,
                quantity: 1,
                unitPrice: totalAmount,
                discountAmount: 0,
                taxAmount: 0,
                total: totalAmount,
              },
            ],
          },
        },
        tx,
      );

      // Advance the billing period in the SAME transaction, guarded by the
      // existing rowVersion optimistic lock: a concurrent overlapping run
      // fails this check and rolls back its invoice insert as well.
      const rowVer = subRecord.rowVersion ?? 0;
      await this.subscriptionRepository.updateByCompany(
        companyId,
        { currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        rowVer,
        tx,
      );

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
          newValues: {
            invoiceNumber,
            amount: totalAmount.toString(),
            status: 'PENDING',
          },
          companyId,
          userId: userId ?? null,
        },
      });

      return { invoice: InvoiceMapper.toEntity(invoice), created: true };
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

      // G13-03-09-03: paidAmount must exactly equal invoice.totalAmount.
      // The billing domain has no partial-payment model — every invoice
      // represents one billing period's subscription fee and must be paid
      // in full. Use Prisma.Decimal for precision-safe comparison so that
      // semantically equivalent representations (e.g. "29.99" == "29.9900")
      // are treated as equal.
      let paidDecimal: Prisma.Decimal;
      try {
        paidDecimal = new Prisma.Decimal(paidAmount);
      } catch {
        throw new BadRequestException(
          `Invalid paidAmount: "${paidAmount}" is not a valid decimal`,
        );
      }
      if (paidDecimal.isNaN() || paidDecimal.isNeg() || paidDecimal.isZero()) {
        throw new BadRequestException(
          `Invalid paidAmount: must be a positive non-zero decimal`,
        );
      }
      if (!paidDecimal.equals(invoice.totalAmount)) {
        throw new BadRequestException(
          `Paid amount ${paidAmount} does not match invoice total ${invoice.totalAmount}`,
        );
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
      await this.paymentTransactionRepository.create(
        {
          company: { connect: { id: companyId } },
          subscription: { connect: { id: invoice.subscriptionId } },
          invoice: { connect: { id } },
          amount: paidAmount,
          currency: invoice.currency as Currency,
          status: 'SUCCEEDED' as PaymentTransactionStatus,
          method: providerInvoiceId ? 'card' : 'manual',
          providerPaymentId: providerInvoiceId ?? null,
          reference: `Payment for invoice ${invoice.invoiceNumber}`,
        },
        tx,
      );

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
          oldValues: {
            status: invoice.status,
            invoiceNumber: invoice.invoiceNumber,
          },
          newValues: { status: 'CANCELLED' },
          companyId,
          userId: null,
        },
      });

      return InvoiceMapper.toEntity(updated);
    });
  }
}
