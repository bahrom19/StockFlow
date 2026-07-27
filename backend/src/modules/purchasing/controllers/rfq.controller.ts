import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RFQStatus } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CreateRFQDto } from '../dto/create-rfq.dto';
import { RFQQQueryDto } from '../dto/rfq-query.dto';
import { RFQEntity } from '../entities/rfq.entity';
import { RFQService } from '../services/rfq.service';

@ApiTags('purchasing / rfqs')
@Controller('purchasing/rfqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RFQController {
  constructor(private readonly service: RFQService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing:create')
  @ApiOperation({ summary: 'Create an RFQ' })
  @ApiBody({ type: CreateRFQDto })
  @ApiResponse({ status: 201, type: RFQEntity })
  async create(
    @Body() dto: CreateRFQDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RFQEntity> {
    return this.service.create(dto, user.userId, user.companyId);
  }

  @Get()
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'List RFQs' })
  async findAll(@Query() query: RFQQQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'Get RFQ by id' })
  @ApiParam({ name: 'id' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RFQEntity> {
    return this.service.findById(id, user.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('purchasing:delete')
  @ApiOperation({ summary: 'Delete a draft RFQ' })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.softDelete(id, user.companyId);
  }

  @Patch(':id/status')
  @RequirePermission('purchasing:update')
  @ApiOperation({ summary: 'Transition RFQ status' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'status', enum: RFQStatus })
  async transitionStatus(
    @Param('id') id: string,
    @Query('status') status: RFQStatus,
    @CurrentUser() user: JwtPayload,
  ): Promise<RFQEntity> {
    return this.service.transitionStatus(
      id,
      status,
      user.userId,
      user.companyId,
    );
  }
}
