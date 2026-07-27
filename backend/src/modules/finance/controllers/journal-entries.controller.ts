import {
  Body,
  Controller,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from '../dto/update-journal-entry.dto';
import { JournalEntryQueryDto } from '../dto/journal-entry-query.dto';
import { JournalEntryEntity } from '../entities/journal-entry.entity';
import { JournalEntriesService } from '../services/journal-entries.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@ApiTags('finance / journal-entries')
@Controller('finance/journal-entries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:create')
  @ApiOperation({ summary: 'Create a journal entry with lines' })
  @ApiBody({ type: CreateJournalEntryDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Journal entry created',
    type: JournalEntryEntity,
  })
  async create(
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<JournalEntryEntity> {
    return this.journalEntriesService.create(dto, currentUser);
  }

  @Get()
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'List journal entries with pagination and filters' })
  @ApiQuery({ name: 'financialPeriodId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'POSTED', 'REVERSED'],
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  @ApiOkResponse({
    description: 'Journal entries retrieved',
    type: PaginatedResponseDto<JournalEntryEntity>,
  })
  async findAll(
    @Query() query: JournalEntryQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.journalEntriesService.findAll(query, currentUser);
  }

  @Get(':id')
  @RequirePermission('finance:read')
  @ApiOperation({ summary: 'Get journal entry by id with lines' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Journal entry retrieved',
    type: JournalEntryEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<JournalEntryEntity> {
    return this.journalEntriesService.findById(id, currentUser);
  }

  @Patch(':id')
  @RequirePermission('finance:update')
  @ApiOperation({ summary: 'Update journal entry (DRAFT only)' })
  @ApiBody({ type: UpdateJournalEntryDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Journal entry updated',
    type: JournalEntryEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateJournalEntryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<JournalEntryEntity> {
    return this.journalEntriesService.update(id, dto, currentUser);
  }

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:post')
  @ApiOperation({ summary: 'Post journal entry (DRAFT → POSTED)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Journal entry posted',
    type: JournalEntryEntity,
  })
  async post(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<JournalEntryEntity> {
    return this.journalEntriesService.post(id, currentUser);
  }
}
