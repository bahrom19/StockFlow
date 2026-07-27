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
import { PurchaseReturnStatus } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CreatePurchaseReturnDto } from '../dto/create-purchase-return.dto';
import { PurchaseReturnQueryDto } from '../dto/purchase-return-query.dto';
import { UpdatePurchaseReturnDto } from '../dto/update-purchase-return.dto';
import { PurchaseReturnEntity } from '../entities/purchase-return.entity';
import { PurchaseReturnService } from '../services/purchase-return.service';

@ApiTags('purchasing / purchase-returns')
@Controller('purchasing/purchase-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseReturnController {
  constructor(private readonly purchaseReturnService: PurchaseReturnService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchasing:create')
  @ApiOperation({ summary: 'Create a purchase return' })
  @ApiBody({ type: CreatePurchaseReturnDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Purchase return created',
    type: PurchaseReturnEntity,
  })
  async create(
    @Body() dto: CreatePurchaseReturnDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PurchaseReturnEntity> {
    return this.purchaseReturnService.create(
      dto,
      currentUser.userId,
      currentUser.companyId,
    );
  }

  @Get()
  @RequirePermission('purchasing:read')
  @ApiOperation({
    summary: 'List purchase returns with pagination and filters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase returns retrieved',
  })
  async findAll(
    @Query() query: PurchaseReturnQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{
    items: PurchaseReturnEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.purchaseReturnService.findAll(query, currentUser.companyId);
  }

  @Get(':id')
  @RequirePermission('purchasing:read')
  @ApiOperation({ summary: 'Get a purchase return by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase return retrieved',
    type: PurchaseReturnEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PurchaseReturnEntity> {
    return this.purchaseReturnService.findById(id, currentUser.companyId);
  }

  @Patch(':id')
  @RequirePermission('purchasing:update')
  @ApiOperation({
    summary: 'Update a draft purchase return (non-status fields)',
  })
  @ApiBody({ type: UpdatePurchaseReturnDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase return updated',
    type: PurchaseReturnEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseReturnDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PurchaseReturnEntity> {
    return this.purchaseReturnService.update(id, dto, currentUser.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('purchasing:delete')
  @ApiOperation({ summary: 'Soft delete a draft purchase return' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Purchase return deleted',
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    return this.purchaseReturnService.softDelete(id, currentUser.companyId);
  }

  @Patch(':id/status')
  @RequirePermission('purchasing:update')
  @ApiOperation({ summary: 'Transition purchase return status' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiQuery({ name: 'status', enum: PurchaseReturnStatus, required: true })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status transitioned',
    type: PurchaseReturnEntity,
  })
  async transitionStatus(
    @Param('id') id: string,
    @Query('status') status: PurchaseReturnStatus,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PurchaseReturnEntity> {
    return this.purchaseReturnService.transitionStatus(
      id,
      status,
      currentUser.userId,
      currentUser.companyId,
    );
  }
}
