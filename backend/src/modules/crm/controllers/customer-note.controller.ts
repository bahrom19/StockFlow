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
import { CustomerNoteService } from '../services/customer-note.service';
import { CustomerNoteEntity } from '../entities/customer-note.entity';
import {
  CreateCustomerNoteDto,
  CustomerNoteQueryDto,
} from '../dto/customer-note.dto';

@ApiTags('crm / customer-notes')
@Controller('crm/customer-notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerNoteController {
  constructor(private readonly service: CustomerNoteService) {}

  @Post(':customerId')
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create customer note' })
  @ApiParam({ name: 'customerId', type: 'string' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CustomerNoteEntity })
  async create(
    @Param('customerId') customerId: string,
    @Body() dto: CreateCustomerNoteDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CustomerNoteEntity> {
    return this.service.create(dto, customerId, user.companyId, user.userId);
  }

  @Get()
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List customer notes' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(
    @Query() query: CustomerNoteQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Delete(':id')
  @RequirePermission('crm:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete customer note' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user.companyId, user.userId);
  }
}
