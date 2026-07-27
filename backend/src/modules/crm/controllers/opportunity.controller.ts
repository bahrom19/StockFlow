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
import { OpportunityService } from '../services/opportunity.service';
import { SalesOpportunityEntity } from '../entities/sales-opportunity.entity';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityQueryDto,
} from '../dto/opportunity.dto';

@ApiTags('crm / opportunities')
@Controller('crm/opportunities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpportunityController {
  constructor(private readonly service: OpportunityService) {}

  @Post()
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create sales opportunity' })
  @ApiResponse({ status: HttpStatus.CREATED, type: SalesOpportunityEntity })
  async create(
    @Body() dto: CreateOpportunityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SalesOpportunityEntity> {
    return this.service.create(dto, user.companyId, user.userId);
  }

  @Get()
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List opportunities' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(
    @Query() query: OpportunityQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get opportunity by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: SalesOpportunityEntity })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SalesOpportunityEntity> {
    return this.service.findOne(id, user.companyId);
  }

  @Patch(':id')
  @RequirePermission('crm:update')
  @ApiOperation({ summary: 'Update opportunity' })
  @ApiBody({ type: UpdateOpportunityDto })
  @ApiResponse({ status: HttpStatus.OK, type: SalesOpportunityEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SalesOpportunityEntity> {
    return this.service.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('crm:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete opportunity' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user.companyId, user.userId);
  }
}
