import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PriceListService } from '../services/price-list.service';
import { PriceListEntity } from '../entities/price-list.entity';
import {
  CreatePriceListDto,
  UpdatePriceListDto,
  PriceListQueryDto,
} from '../dto/price-list.dto';

@ApiTags('crm / price-lists')
@Controller('crm/price-lists')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PriceListController {
  constructor(private readonly service: PriceListService) {}

  @Post()
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create price list' })
  @ApiResponse({ status: HttpStatus.CREATED, type: PriceListEntity })
  async create(
    @Body() dto: CreatePriceListDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PriceListEntity> {
    return this.service.create(dto, user.companyId, user.userId);
  }

  @Get()
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List price lists' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(
    @Query() query: PriceListQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get price list by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: PriceListEntity })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PriceListEntity> {
    return this.service.findOne(id, user.companyId);
  }

  @Patch(':id')
  @RequirePermission('crm:update')
  @ApiOperation({ summary: 'Update price list' })
  @ApiBody({ type: UpdatePriceListDto })
  @ApiResponse({ status: HttpStatus.OK, type: PriceListEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePriceListDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PriceListEntity> {
    return this.service.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('crm:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete price list' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user.companyId, user.userId);
  }
}
