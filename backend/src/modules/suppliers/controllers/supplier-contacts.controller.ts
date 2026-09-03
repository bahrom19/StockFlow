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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSupplierContactDto } from '../dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from '../dto/update-supplier-contact.dto';
import { SupplierContactEntity } from '../entities/supplier-contact.entity';
import { SupplierContactsService } from '../services/supplier-contacts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('suppliers / contacts')
@Controller('suppliers/:supplierId/contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierContactsController {
  constructor(private readonly contactsService: SupplierContactsService) {}

  @Get()
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'List supplier contacts' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contacts retrieved',
    type: [SupplierContactEntity],
  })
  async findAll(
    @Param('supplierId') supplierId: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierContactEntity[]> {
    return this.contactsService.findAll(supplierId, currentUser);
  }

  @Get(':contactId')
  @RequirePermission('suppliers:read')
  @ApiOperation({ summary: 'Get supplier contact by id' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiParam({ name: 'contactId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contact retrieved',
    type: SupplierContactEntity,
  })
  async findById(
    @Param('supplierId') supplierId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierContactEntity> {
    return this.contactsService.findById(supplierId, contactId, currentUser);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Create a supplier contact' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiBody({ type: CreateSupplierContactDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Contact created',
    type: SupplierContactEntity,
  })
  async create(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierContactDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierContactEntity> {
    return this.contactsService.create(supplierId, dto, currentUser);
  }

  @Patch(':contactId')
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Update a supplier contact' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiParam({ name: 'contactId', type: 'string' })
  @ApiBody({ type: UpdateSupplierContactDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contact updated',
    type: SupplierContactEntity,
  })
  async update(
    @Param('supplierId') supplierId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateSupplierContactDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<SupplierContactEntity> {
    return this.contactsService.update(
      supplierId,
      contactId,
      dto,
      currentUser,
    );
  }

  @Delete(':contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('suppliers:update')
  @ApiOperation({ summary: 'Soft delete a supplier contact' })
  @ApiParam({ name: 'supplierId', type: 'string' })
  @ApiParam({ name: 'contactId', type: 'string' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Contact soft deleted',
  })
  async softDelete(
    @Param('supplierId') supplierId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    await this.contactsService.softDelete(supplierId, contactId, currentUser);
  }
}
