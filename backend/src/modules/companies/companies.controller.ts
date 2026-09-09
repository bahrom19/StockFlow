import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CompaniesService } from './services/companies.service';
import { UpdateCompanyCurrencyDto } from './dto/update-company-currency.dto';
import { CompanyCurrencyResponseDto } from './dto/company-currency.response.dto';

@ApiTags('companies')
@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  @UseGuards(RolesGuard)
  @RequirePermission('settings:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current company currency settings' })
  @ApiResponse({
    status: 200,
    description: 'Company currency info',
    type: CompanyCurrencyResponseDto,
  })
  async getCurrency(
    @CurrentUser() user: JwtPayload,
  ): Promise<CompanyCurrencyResponseDto> {
    return this.companiesService.getCompanyCurrency(user.companyId);
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @RequirePermission('settings:update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update company currency (one-time, before monetary data)' })
  @ApiResponse({
    status: 200,
    description: 'Currency updated',
    type: CompanyCurrencyResponseDto,
  })
  async updateCurrency(
    @Body() dto: UpdateCompanyCurrencyDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompanyCurrencyResponseDto> {
    return this.companiesService.updateCurrency(
      user.companyId,
      dto,
      user.userId,
    );
  }
}
