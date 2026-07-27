import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
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
  ) {}

  async openShift(
    dto: OpenShiftDto,
    userId: string,
    companyId: string,
  ): Promise<CashShiftEntity> {
    const existing = await this.cashShiftRepository.findOpenShift(
      dto.warehouseId,
      userId,
      companyId,
    );
    if (existing) {
      throw new BadRequestException(
        'An open shift already exists for this warehouse and cashier',
      );
    }

    const shift = await this.cashShiftRepository.create({
      openingBalance: new Decimal(dto.openingBalance),
      closingBalance: new Decimal(dto.openingBalance),
      expectedClosing: new Decimal(dto.openingBalance),
      notes: dto.notes,
      company: { connect: { id: companyId } },
      warehouse: { connect: { id: dto.warehouseId } },
      cashier: { connect: { id: userId } },
    });

    return CashShiftMapper.toEntity(shift);
  }

  async closeShift(
    dto: CloseShiftDto,
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
    );

    return CashShiftMapper.toEntity(updated);
  }

  async cashIn(
    dto: CashInOutDto,
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

    const currentCashIn = new Decimal(shift.cashIn.toString());
    const updated = await this.cashShiftRepository.update(
      shift.id,
      {
        cashIn: currentCashIn.add(new Decimal(dto.amount)),
        notes: dto.reason
          ? `${shift.notes ?? ''} In: ${dto.reason}`.trim()
          : shift.notes,
      },
      companyId,
    );

    return CashShiftMapper.toEntity(updated);
  }

  async cashOut(
    dto: CashInOutDto,
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

    const currentCashOut = new Decimal(shift.cashOut.toString());
    const updated = await this.cashShiftRepository.update(
      shift.id,
      {
        cashOut: currentCashOut.add(new Decimal(dto.amount)),
        notes: dto.reason
          ? `${shift.notes ?? ''} Out: ${dto.reason}`.trim()
          : shift.notes,
      },
      companyId,
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
