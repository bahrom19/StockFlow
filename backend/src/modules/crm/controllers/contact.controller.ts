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
import { ContactService } from '../services/contact.service';
import { ContactEntity } from '../entities/contact.entity';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactQueryDto,
} from '../dto/contact.dto';

@ApiTags('crm / contacts')
@Controller('crm/contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Post()
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a contact' })
  @ApiResponse({ status: HttpStatus.CREATED, type: ContactEntity })
  async create(
    @Body() dto: CreateContactDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ContactEntity> {
    return this.service.create(dto, user.companyId, user.userId);
  }

  @Get()
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List contacts' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(
    @Query() query: ContactQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get contact by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: ContactEntity })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ContactEntity> {
    return this.service.findOne(id, user.companyId);
  }

  @Patch(':id')
  @RequirePermission('crm:update')
  @ApiOperation({ summary: 'Update contact' })
  @ApiBody({ type: UpdateContactDto })
  @ApiResponse({ status: HttpStatus.OK, type: ContactEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ContactEntity> {
    return this.service.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('crm:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete contact' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user.companyId, user.userId);
  }
}
