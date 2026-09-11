import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Prisma, PurchaseInvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { runWithIdempotency } from '../../../infrastructure/idempotency/idempotency.helper';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { PrismaService } from '../../../common/prisma';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierPaymentsRepository } from '../repositories/supplier-payments.repository';
import { SupplierPaymentEntity } from '../entities/supplier-payment.entity';
import { SupplierFinanceSummaryEntity } from '../entities/supplier-finance-summary.entity';
import { CreateSupplierPaymentDto } from '../dto/create-supplier-payment.dto';
import { UpdateSupplierPaymentDto } from '../dto/update-supplier-payment.dto';
import { toPaymentEntity } from '../mappers/supplier-payment.mapper';
import { CompaniesService } from '../../companies/services/companies.service';

const ACCOUNT_CODES = {
  ACCOUNTS_PAYABLE: '2100',
} as const;

const ALLOWED_INVOICE_STATUSES: PurchaseInvoiceStatus[] = [
  PurchaseInvoiceStatus.APPROVED,
  PurchaseInvoiceStatus.PAID,
];

@Injectable()
export class SupplierPaymentsService {
  private readonly logger = new Logger(SupplierPaymentsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly suppliersRepo: SuppliersRepository,
    private readonly paymentsRepo: SupplierPaymentsRepository,
    private readonly glEngine: GlEngineService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly companiesService: CompaniesService,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─────────────────────────────────────────────
  // CREATE PAYMENT
  // ─────────────────────────────────────────────

  async create(
    supplierId: string,
    dto: CreateSupplierPaymentDto,
    userId: string,
    companyId: string,
    idempotencyKey?: string,
  ): Promise<SupplierPaymentEntity> {
    // 1. Verify supplier belongs to company
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // 2. Validate amount
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // 3. Validate currency == Company.currency
    const companyCurrency = await this.companiesService.getBaseCurrency(companyId);
    if (dto.currency && dto.currency !== companyCurrency) {
      throw new BadRequestException(
        `Currency ${dto.currency} does not match company currency ${companyCurrency}`,
      );
    }

    // 4. Validate method + account combination
    this.validateMethodAccount(dto);

    // 5. G3-1: keyed mutation. The IdempotencyRecord reservation, the payment
    // row, the invoice paidAmount CAS, the GL journal and the audit log all
    // commit (or roll back) inside ONE transaction — a payment can never be
    // committed without its reservation, and a failure rolls the reservation
    // back together with the payment. No key → legacy single-transaction
    // behavior, unchanged.
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId,
      idempotencyKey,
      endpoint: 'supplier-payment-create',
      requestHashPayload: { supplierId, ...dto, userId },
      status: HttpStatus.CREATED,
      work: (tx) =>
        this.applyCreatePayment({
          supplierId,
          dto,
          userId,
          companyId,
          companyCurrency,
          supplierName: supplier.companyName,
          tx,
        }),
    });
    return result.body as SupplierPaymentEntity;
  }

  /**
   * G3-1: atomic payment body. Runs inside the caller's transaction (the
   * idempotency reservation or the legacy transaction) so the payment row,
   * the invoice update, the GL journal and the audit log commit (or roll
   * back) together.
   */
  private async applyCreatePayment(params: {
    supplierId: string;
    dto: CreateSupplierPaymentDto;
    userId: string;
    companyId: string;
    companyCurrency: string;
    supplierName: string;
    tx: Prisma.TransactionClient;
  }): Promise<SupplierPaymentEntity> {
    const { supplierId, dto, userId, companyId, companyCurrency, supplierName, tx } = params;
    const amount = new Decimal(dto.amount);

    // 6. Get invoice and validate (tenant-scoped: id + companyId + supplierId)
    const invoice = await tx.purchaseInvoice.findFirst({
      where: {
        id: dto.purchaseInvoiceId,
        companyId,
        supplierId,
        deletedAt: null,
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Purchase invoice ${dto.purchaseInvoiceId} not found for this supplier`,
      );
    }

    if (!ALLOWED_INVOICE_STATUSES.includes(invoice.status as PurchaseInvoiceStatus)) {
      throw new BadRequestException(
        `Cannot record payment for invoice with status ${invoice.status}. Only APPROVED or PAID invoices are accepted.`,
      );
    }

    // 7. G3-2: invoice currency must match the company base currency.
    // The payment is always recorded in company currency — no FX, no
    // conversion. A mismatch rejects before any write happens.
    if (invoice.currency !== companyCurrency) {
      throw new BadRequestException(
        `Invoice currency ${invoice.currency} does not match company currency ${companyCurrency}`,
      );
    }

    // 8. Check overpayment
    const currentPaid = new Decimal(invoice.paidAmount);
    const grandTotal = new Decimal(invoice.grandTotal);
    const newPaid = currentPaid.add(amount);

    if (newPaid.gt(grandTotal)) {
      throw new BadRequestException(
        `Payment of ${amount.toString()} exceeds outstanding amount. Current paid: ${currentPaid.toString()}, grand total: ${grandTotal.toString()}`,
      );
    }

    // 9. Resolve GL accounts
    const apAccountId = await this.getAccountsPayableAccountId(companyId, tx);
    if (!apAccountId) {
      throw new BadRequestException('Chart of Accounts not configured — Accounts Payable account (2100) not found');
    }

    const creditAccountId = await this.resolveCreditAccountId(dto, companyId, tx);

    // 10. Determine new invoice status
    const newStatus = newPaid.gte(grandTotal)
      ? PurchaseInvoiceStatus.PAID
      : invoice.status as PurchaseInvoiceStatus;

    // 11. Generate payment number
    const seq = await this.documentSequenceService.nextNumber(
      companyId,
      'SUPPLIER_PAYMENT',
      tx,
    );
    const paymentNumber = `PAY-${String(seq).padStart(6, '0')}`;

    // 12. Create payment record
    const payment = await this.paymentsRepo.create(
      {
        company: { connect: { id: companyId } },
        supplier: { connect: { id: supplierId } },
        purchaseInvoice: { connect: { id: dto.purchaseInvoiceId } },
        paymentNumber,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        amount: amount.toString(),
        method: dto.method,
        currency: companyCurrency as Currency,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        ...(dto.cashAccountId
          ? { cashAccount: { connect: { id: dto.cashAccountId } } }
          : {}),
        ...(dto.bankAccountId
          ? { bankAccount: { connect: { id: dto.bankAccountId } } }
          : {}),
        createdByUser: { connect: { id: userId } },
      },
      tx,
    );

    // 13. Update invoice paidAmount + status with concurrency check
    const updateResult = await tx.purchaseInvoice.updateMany({
      where: {
        id: dto.purchaseInvoiceId,
        companyId,
        rowVersion: invoice.rowVersion,
      },
      data: {
        paidAmount: newPaid.toString(),
        rowVersion: { increment: 1 },
        ...(newPaid.gte(grandTotal) ? { status: PurchaseInvoiceStatus.PAID } : {}),
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictException(
        'Invoice was modified by another user. Please refresh and retry.',
      );
    }

    // 14. Create journal entry: Dr AP / Cr Cash|Bank
    await this.glEngine.post(
      {
        companyId,
        financialPeriodId: await this.getOpenPeriodId(tx, companyId),
        entryDate: payment.paymentDate,
        description: `Supplier payment: ${paymentNumber} to ${supplierName}`,
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: payment.id,
        createdBy: userId,
        lines: [
          {
            accountId: apAccountId,
            debit: amount.toString(),
            credit: '0',
            description: `Payment ${paymentNumber} — reduce AP`,
          },
          {
            accountId: creditAccountId,
            debit: '0',
            credit: amount.toString(),
            description: `Payment ${paymentNumber} — cash/bank outflow`,
          },
        ],
      },
      tx,
    );

    // 15. G3-3: audit log — same transaction as the payment row, the invoice
    // update and the GL journal (rollback-safe: a failed payment leaves no
    // audit trace).
    await this.auditLogService.log(
      {
        companyId,
        userId,
        entityType: 'SupplierPayment',
        entityId: payment.id,
        action: 'CREATED',
        before: null,
        after: {
          paymentNumber: payment.paymentNumber,
          supplierId,
          purchaseInvoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: amount.toString(),
          currency: companyCurrency,
          method: payment.method,
          cashAccountId: dto.cashAccountId ?? null,
          bankAccountId: dto.bankAccountId ?? null,
          reference: dto.reference ?? null,
          paymentDate: payment.paymentDate,
        },
      },
      tx,
    );

    this.logger.log(
      `Payment ${paymentNumber} created: ${amount.toString()} ${companyCurrency} for invoice ${invoice.invoiceNumber}`,
    );

    return toPaymentEntity(payment);
  }

  // ─────────────────────────────────────────────
  // LIST PAYMENTS
  // ─────────────────────────────────────────────

  async findAll(
    supplierId: string,
    companyId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: SupplierPaymentEntity[]; total: number; page: number; limit: number }> {
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    const { items, total } = await this.paymentsRepo.findAllBySupplier(
      supplierId,
      companyId,
      page,
      limit,
    );

    return {
      items: items.map(toPaymentEntity),
      total,
      page,
      limit,
    };
  }

  // ─────────────────────────────────────────────
  // GET BY ID
  // ─────────────────────────────────────────────

  async findById(
    paymentId: string,
    supplierId: string,
    companyId: string,
  ): Promise<SupplierPaymentEntity> {
    const payment = await this.paymentsRepo.findById(
      paymentId,
      supplierId,
      companyId,
    );
    if (!payment) {
      throw new NotFoundException(`Supplier payment ${paymentId} not found`);
    }
    return toPaymentEntity(payment);
  }

  // ─────────────────────────────────────────────
  // VOID (soft delete + reversal journal)
  // ─────────────────────────────────────────────

  async void(
    paymentId: string,
    supplierId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    // 1. Get payment (include deleted check)
    const payment = await this.paymentsRepo.findById(
      paymentId,
      supplierId,
      companyId,
    );
    if (!payment) {
      throw new NotFoundException(`Supplier payment ${paymentId} not found`);
    }

    // 2. Get invoice
    const invoice = await this.prismaService.purchaseInvoice.findFirst({
      where: {
        id: payment.purchaseInvoiceId,
        companyId,
        deletedAt: null,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Associated purchase invoice not found');
    }

    // 3. Resolve GL accounts
    const apAccountId = await this.getAccountsPayableAccountId(companyId);
    if (!apAccountId) {
      throw new BadRequestException('Chart of Accounts not configured');
    }

    const creditAccountId = await this.resolveCreditAccountIdFromPayment(payment, companyId);
    if (!creditAccountId) {
      throw new BadRequestException('Cannot resolve account from original payment');
    }

    await this.prismaService.$transaction(async (tx) => {
      // 4. Soft-delete payment
      await this.paymentsRepo.softDelete(paymentId, supplierId, companyId, tx);

      // 5. Restore invoice paidAmount
      const currentPaid = new Decimal(invoice.paidAmount);
      const paymentAmount = new Decimal(payment.amount);
      const restoredPaid = currentPaid.sub(paymentAmount);

      if (restoredPaid.lt(0)) {
        throw new BadRequestException('Cannot void: paidAmount would become negative');
      }

      const newStatus = restoredPaid.lt(new Decimal(invoice.grandTotal))
        ? PurchaseInvoiceStatus.APPROVED
        : (invoice.status as PurchaseInvoiceStatus);

      const updateResult = await tx.purchaseInvoice.updateMany({
        where: {
          id: payment.purchaseInvoiceId,
          companyId,
          rowVersion: invoice.rowVersion,
        },
        data: {
          paidAmount: restoredPaid.toString(),
          rowVersion: { increment: 1 },
          ...(newStatus === PurchaseInvoiceStatus.APPROVED
            ? { status: PurchaseInvoiceStatus.APPROVED }
            : {}),
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'Invoice was modified by another user. Please refresh and retry.',
        );
      }

      // 6. Create reversal journal: Dr Cash|Bank / Cr AP
      await this.glEngine.post(
        {
          companyId,
          financialPeriodId: await this.getOpenPeriodId(tx, companyId),
          entryDate: new Date(),
          description: `Reversal of supplier payment: ${payment.paymentNumber}`,
          referenceType: 'SUPPLIER_PAYMENT_REVERSAL',
          referenceId: payment.id,
          createdBy: userId,
          lines: [
            {
              accountId: creditAccountId,
              debit: String(payment.amount),
              credit: '0',
              description: `Reversal ${payment.paymentNumber} — cash/bank inflow`,
            },
            {
              accountId: apAccountId,
              debit: '0',
              credit: String(payment.amount),
              description: `Reversal ${payment.paymentNumber} — restore AP`,
            },
          ],
        },
        tx,
      );

      // 7. G3-3: audit log — same transaction as the soft delete, the invoice
      // restore and the reversal journal (rollback-safe: a failed void leaves
      // no audit trace).
      await this.auditLogService.log(
        {
          companyId,
          userId,
          entityType: 'SupplierPayment',
          entityId: payment.id,
          action: 'VOIDED',
          before: {
            status: 'ACTIVE',
            paymentNumber: payment.paymentNumber,
            amount: payment.amount.toString(),
            supplierId: payment.supplierId,
            purchaseInvoiceId: payment.purchaseInvoiceId,
            invoiceNumber: invoice.invoiceNumber,
            paidAmountBefore: currentPaid.toString(),
          },
          after: {
            status: 'VOIDED',
            reversalReferenceType: 'SUPPLIER_PAYMENT_REVERSAL',
            reversalReferenceId: payment.id,
            paidAmountAfter: restoredPaid.toString(),
          },
        },
        tx,
      );

      this.logger.log(
        `Payment ${payment.paymentNumber} voided: reversal journal created`,
      );
    });
  }

  // ─────────────────────────────────────────────
  // PATCH (notes/reference only)
  // ─────────────────────────────────────────────

  async patch(
    paymentId: string,
    supplierId: string,
    companyId: string,
    dto: UpdateSupplierPaymentDto,
  ): Promise<SupplierPaymentEntity> {
    const existing = await this.paymentsRepo.findById(
      paymentId,
      supplierId,
      companyId,
    );
    if (!existing) {
      throw new NotFoundException(`Supplier payment ${paymentId} not found`);
    }

    // G3-4: optimistic locking — CAS on the payment rowVersion. The repo
    // throws ConflictException when the stored rowVersion no longer matches.
    const payment = await this.paymentsRepo.update(
      paymentId,
      supplierId,
      companyId,
      dto.rowVersion,
      {
        ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    );

    return toPaymentEntity(payment);
  }

  // ─────────────────────────────────────────────
  // FINANCE SUMMARY
  // ─────────────────────────────────────────────

  async getFinanceSummary(
    supplierId: string,
    companyId: string,
  ): Promise<SupplierFinanceSummaryEntity> {
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // Company base currency — explicit label for the returned amounts
    const currency = await this.companiesService.getBaseCurrency(companyId);

    // Total invoiced (APPROVED + PAID invoices, excluding CANCELLED)
    const invoiceAgg = await this.prismaService.purchaseInvoice.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        status: { in: [PurchaseInvoiceStatus.APPROVED, PurchaseInvoiceStatus.PAID] },
      },
      _sum: { grandTotal: true },
      _count: { id: true },
    });

    // Total paid
    const paymentAgg = await this.prismaService.supplierPayment.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    // Total returned
    const returnAgg = await this.prismaService.purchaseReturn.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
      _sum: { grandTotal: true },
    });

    // Last payment
    const lastPayment = await this.prismaService.supplierPayment.findFirst({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
      },
      orderBy: { paymentDate: 'desc' },
      select: { paymentDate: true, amount: true },
    });

    const totalInvoiced = new Decimal(invoiceAgg._sum.grandTotal ?? 0);
    const totalPaid = new Decimal(paymentAgg._sum.amount ?? 0);
    const totalReturned = new Decimal(returnAgg._sum.grandTotal ?? 0);
    const outstanding = totalInvoiced.sub(totalPaid).sub(totalReturned);

    return {
      supplierId,
      currency,
      totalInvoiced: totalInvoiced.toString(),
      totalPaid: totalPaid.toString(),
      totalReturned: totalReturned.toString(),
      outstanding: outstanding.toString(),
      invoiceCount: invoiceAgg._count.id,
      paymentCount: paymentAgg._count.id,
      lastPaymentDate: lastPayment?.paymentDate ?? null,
      lastPaymentAmount: lastPayment?.amount?.toString() ?? null,
    };
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private validateMethodAccount(dto: CreateSupplierPaymentDto): void {
    if (dto.method === 'CASH') {
      if (!dto.cashAccountId) {
        throw new BadRequestException('cashAccountId is required for CASH payments');
      }
      if (dto.bankAccountId) {
        throw new BadRequestException('bankAccountId must be null for CASH payments');
      }
    } else {
      // BANK_TRANSFER or CARD
      if (!dto.bankAccountId) {
        throw new BadRequestException('bankAccountId is required for BANK_TRANSFER/CARD payments');
      }
      if (dto.cashAccountId) {
        throw new BadRequestException('cashAccountId must be null for BANK_TRANSFER/CARD payments');
      }
    }
  }

  private async resolveCreditAccountId(
    dto: CreateSupplierPaymentDto,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    if (dto.method === 'CASH' && dto.cashAccountId) {
      const cashAccount = await tx.cashAccount.findFirst({
        where: { id: dto.cashAccountId, companyId, deletedAt: null },
        select: { chartOfAccountId: true },
      });
      if (!cashAccount?.chartOfAccountId) {
        throw new BadRequestException('Cash account not found or not linked to a Chart of Account');
      }
      return cashAccount.chartOfAccountId;
    }

    if (dto.bankAccountId) {
      const bankAccount = await tx.bankAccount.findFirst({
        where: { id: dto.bankAccountId, companyId, deletedAt: null },
        select: { chartOfAccountId: true },
      });
      if (!bankAccount?.chartOfAccountId) {
        throw new BadRequestException('Bank account not found or not linked to a Chart of Account');
      }
      return bankAccount.chartOfAccountId;
    }

    throw new BadRequestException('Cannot resolve payment account');
  }

  private async resolveCreditAccountIdFromPayment(
    payment: { method: string; cashAccountId: string | null; bankAccountId: string | null },
    companyId: string,
  ): Promise<string | null> {
    if (payment.method === 'CASH' && payment.cashAccountId) {
      const cashAccount = await this.prismaService.cashAccount.findFirst({
        where: { id: payment.cashAccountId, companyId, deletedAt: null },
        select: { chartOfAccountId: true },
      });
      return cashAccount?.chartOfAccountId ?? null;
    }

    if (payment.bankAccountId) {
      const bankAccount = await this.prismaService.bankAccount.findFirst({
        where: { id: payment.bankAccountId, companyId, deletedAt: null },
        select: { chartOfAccountId: true },
      });
      return bankAccount?.chartOfAccountId ?? null;
    }

    return null;
  }

  private async getAccountsPayableAccountId(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    const client = tx ?? this.prismaService;
    const account = await client.chartOfAccount.findFirst({
      where: {
        companyId,
        code: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    return account?.id ?? null;
  }

  private async getOpenPeriodId(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    const period = await tx.financialPeriod.findFirst({
      where: { companyId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (!period) {
      throw new BadRequestException(
        `No open financial period found for company ${companyId}`,
      );
    }
    return period.id;
  }
}
