import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, Currency } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { runWithIdempotency } from '../../../infrastructure/idempotency/idempotency.helper';
import { CashShiftEntity } from '../entities/cash-shift.entity';
import { CashShiftMapper } from '../mappers/cash-shift.mapper';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import {
  OpenShiftDto,
  CloseShiftDto,
  CashInOutDto,
} from '../dto/cash-shift.dto';

@Injectable()
export class CashShiftService {
  constructor(
    private readonly cashShiftRepository: CashShiftRepository,
    private readonly prismaService: PrismaService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  /**
   * Open a cash shift atomically.
   *
   * Race protection (H1): the duplicate-OPEN check AND the insert run inside a
   * single DB transaction, and a partial unique index
   * `CashShift_open_shift_unique` on (warehouseId, cashierId, companyId) WHERE
   * status='OPEN' rejects a second concurrent OPEN shift at the DB level
   * (P2002). Both the pre-check and the P2002 path map to HTTP 409 Conflict.
   */
  async openShift(
    dto: OpenShiftDto,
    userId: string,
    companyId: string,
  ): Promise<CashShiftEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.cashShiftRepository.findOpenShift(
        dto.warehouseId,
        userId,
        companyId,
        tx,
      );
      if (existing) {
        throw new ConflictException(
          'An open shift already exists for this warehouse and cashier',
        );
      }

      try {
        const shift = await this.cashShiftRepository.create(
          {
            openingBalance: new Decimal(dto.openingBalance),
            closingBalance: new Decimal(dto.openingBalance),
            expectedClosing: new Decimal(dto.openingBalance),
            currency: (dto.currency ?? 'KZT') as Currency,
            notes: dto.notes,
            company: { connect: { id: companyId } },
            warehouse: { connect: { id: dto.warehouseId } },
            cashier: { connect: { id: userId } },
          },
          tx,
        );
        return CashShiftMapper.toEntity(shift);
      } catch (err) {
        // DB-level protection: a concurrent request already opened a shift
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException(
            'An open shift already exists for this warehouse and cashier',
          );
        }
        throw err;
      }
    });
  }

  async closeShift(
    dto: CloseShiftDto,
    userId: string,
    companyId: string,
    warehouseId: string,
  ): Promise<CashShiftEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const shift = await this.cashShiftRepository.findOpenShift(
        warehouseId,
        userId,
        companyId,
        tx,
      );
      if (!shift) throw new NotFoundException('No open shift found');

      const openingBalance = new Decimal(shift.openingBalance.toString());
      const cashSales = new Decimal(shift.cashSales.toString());
      const cardSales = new Decimal(shift.cardSales.toString());
      const cashIn = new Decimal(shift.cashIn.toString());
      const cashOut = new Decimal(shift.cashOut.toString());
      const expectedClosing = openingBalance
        .add(cashSales)
        .add(cashIn)
        .sub(cashOut);
      const actualClosing =
        dto.actualClosingBalance != null
          ? new Decimal(dto.actualClosingBalance)
          : expectedClosing;
      const difference = actualClosing.sub(expectedClosing);

      const updated = await this.cashShiftRepository.update(
        shift.id,
        {
          status: 'CLOSED',
          closedAt: new Date(),
          closingBalance: actualClosing,
          expectedClosing,
          difference,
          notes: dto.notes ?? shift.notes,
        },
        companyId,
        shift.rowVersion ?? 0,
        tx,
      );

      return CashShiftMapper.toEntity(updated);
    });
  }

  async cashIn(
    dto: CashInOutDto,
    userId: string,
    companyId: string,
    warehouseId: string,
    idempotencyKey?: string,
  ): Promise<CashShiftEntity> {
    return this.cashMutation(
      dto,
      userId,
      companyId,
      warehouseId,
      'cashIn',
      idempotencyKey,
    );
  }

  async cashOut(
    dto: CashInOutDto,
    userId: string,
    companyId: string,
    warehouseId: string,
    idempotencyKey?: string,
  ): Promise<CashShiftEntity> {
    return this.cashMutation(
      dto,
      userId,
      companyId,
      warehouseId,
      'cashOut',
      idempotencyKey,
    );
  }

  /**
   * F2 — idempotency-aware entry point for cashIn/cashOut.
   *
   * The reservation, the read-modify-write mutation and the saved response
   * run inside ONE Prisma transaction (via `runWithIdempotency`), so the same
   * Idempotency-Key can never increment `CashShift.cashIn`/`cashOut` twice.
   * Because the shift lookup and amount arithmetic are part of the same
   * transaction, the atomicity and optimistic-locking (rowVersion) guarantees
   * of the underlying mutation are preserved on the keyed path.
   */
  private async cashMutation(
    dto: CashInOutDto,
    userId: string,
    companyId: string,
    warehouseId: string,
    kind: 'cashIn' | 'cashOut',
    idempotencyKey?: string,
  ): Promise<CashShiftEntity> {
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId,
      idempotencyKey,
      endpoint: kind === 'cashIn' ? 'cash-in' : 'cash-out',
      // The warehouse and acting user both change which open shift is
      // credited, so they are part of the request hash.
      requestHashPayload: { ...dto, warehouseId, userId },
      status: HttpStatus.OK,
      work: (tx) =>
        this.applyCashMutation(dto, userId, companyId, warehouseId, kind, tx),
    });
    return result.body as CashShiftEntity;
  }

  /**
   * Shared atomic read-modify-write for cashIn/cashOut (H2). The read, the
   * Decimal arithmetic and the rowVersion-guarded write all happen inside one
   * transaction, so a concurrent mutation cannot be silently lost.
   */
  private async applyCashMutation(
    dto: CashInOutDto,
    userId: string,
    companyId: string,
    warehouseId: string,
    kind: 'cashIn' | 'cashOut',
    tx: Prisma.TransactionClient,
  ): Promise<CashShiftEntity> {
    const shift = await this.cashShiftRepository.findOpenShift(
      warehouseId,
      userId,
      companyId,
      tx,
    );
    if (!shift) throw new NotFoundException('No open shift found');

    const amount = new Decimal(dto.amount);
    if (amount.isNegative()) {
      throw new BadRequestException('Amount must not be negative');
    }

    const current =
      kind === 'cashIn'
        ? new Decimal(shift.cashIn.toString())
        : new Decimal(shift.cashOut.toString());

    const updated = await this.cashShiftRepository.update(
      shift.id,
      {
        [kind]: current.add(amount),
        notes: dto.reason
          ? `${shift.notes ?? ''} ${kind === 'cashIn' ? 'In' : 'Out'}: ${dto.reason}`.trim()
          : shift.notes,
      },
      companyId,
      shift.rowVersion ?? 0,
      tx,
    );

    return CashShiftMapper.toEntity(updated);
  }

  async getXReport(
    userId: string,
    companyId: string,
    warehouseId: string,
  ): Promise<CashShiftEntity> {
    const shift = await this.cashShiftRepository.findOpenShift(
      warehouseId,
      userId,
      companyId,
    );
    if (!shift) throw new NotFoundException('No open shift found');
    return CashShiftMapper.toEntity(shift);
  }

  async getZReport(
    shiftId: string,
    companyId: string,
  ): Promise<CashShiftEntity> {
    const shift = await this.cashShiftRepository.findById(shiftId, companyId);
    if (!shift) throw new NotFoundException(`Cash shift ${shiftId} not found`);
    return CashShiftMapper.toEntity(shift);
  }

  async listShifts(
    companyId: string,
    params: {
      warehouseId?: string;
      cashierId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    items: CashShiftEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');
    const result = await this.cashShiftRepository.listByCompany(
      companyId,
      params,
    );
    return {
      items: CashShiftMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }
}
