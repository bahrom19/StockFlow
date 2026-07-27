import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { GlEngineService } from '../services/gl-engine.service';
import { FiscalYearCloseService } from '../services/fiscal-year-close.service';

@ApiTags('finance / gl-engine')
@Controller('finance/gl')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GlEngineController {
  constructor(
    private readonly glEngine: GlEngineService,
    private readonly fiscalYearClose: FiscalYearCloseService,
  ) {}

  @Post('post')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:post')
  @ApiOperation({
    summary:
      'Create and post a journal entry (immutable — goes directly to POSTED)',
  })
  @ApiResponse({ status: 201, description: 'Journal entry posted' })
  async post(
    @Body()
    dto: {
      financialPeriodId: string;
      entryDate?: string;
      description?: string;
      referenceType?: string;
      referenceId?: string;
      lines: Array<{
        accountId: string;
        debit?: string;
        credit?: string;
        description?: string;
      }>;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.glEngine.post({
      companyId: user.companyId,
      financialPeriodId: dto.financialPeriodId,
      entryDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
      description: dto.description,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      createdBy: user.userId,
      lines: dto.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit || '0',
        credit: l.credit || '0',
        description: l.description,
      })),
    });
  }

  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:post')
  @ApiOperation({
    summary: 'Reverse a posted journal entry (creates reversal entry)',
  })
  @ApiParam({ name: 'id', description: 'Journal entry ID to reverse' })
  @ApiResponse({ status: 200, description: 'Entry reversed' })
  async reverse(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.glEngine.reverse(id, user.companyId, user.userId, dto.reason);
  }

  @Post('fiscal-year/:year/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:close')
  @ApiOperation({
    summary: 'Close a fiscal year with retained earnings transfer',
  })
  @ApiParam({
    name: 'year',
    type: 'number',
    description: 'Fiscal year to close',
  })
  @ApiResponse({ status: 200, description: 'Fiscal year closed' })
  async closeFiscalYear(
    @Param('year') year: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.fiscalYearClose.closeFiscalYear(
      user.companyId,
      parseInt(year, 10),
      user.userId,
    );
  }
}
