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
import { PlatformOperatorGuard } from '../../../common/guards/platform-operator.guard';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { PermissionEntity } from '../entities/permission.entity';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { RequirePlatformOperator } from '../decorators/require-platform-operator.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionsService } from '../services/permissions.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('rbac / permissions')
@Controller('rbac/permissions')
// G16-N-4 P0-A: Permission is the GLOBAL authorization substrate — it has no
// companyId and every tenant's RolePermission rows point at it. Mutations are
// therefore platform-only. PlatformOperatorGuard runs BEFORE RolesGuard so the
// platform boundary can never be satisfied by tenant RBAC (which is
// self-grantable: assignPermissionsToAdminRoles() hands the whole catalog to
// every tenant Admin role). RolesGuard still enforces the tenant permission —
// the two requirements are additive.
@UseGuards(JwtAuthGuard, PlatformOperatorGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePlatformOperator()
  @RequirePermission('roles:create')
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiBody({ type: CreatePermissionDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Permission created',
    type: PermissionEntity,
  })
  async create(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PermissionEntity> {
    return this.permissionsService.create(dto, user.userId);
  }

  @Get()
  @RequirePermission('roles:read')
  @ApiOperation({ summary: 'List all permissions' })
  @ApiQuery({
    name: 'module',
    required: false,
    description: 'Filter by module name',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Permissions retrieved' })
  async findAll(
    @Query('module') module?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    items: PermissionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.permissionsService.findAll({
      module,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get(':id')
  @RequirePermission('roles:read')
  @ApiOperation({ summary: 'Get a permission by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Permission retrieved',
    type: PermissionEntity,
  })
  async findById(@Param('id') id: string): Promise<PermissionEntity> {
    return this.permissionsService.findById(id);
  }

  @Get('code/:code')
  @RequirePermission('roles:read')
  @ApiOperation({ summary: 'Get a permission by code' })
  @ApiParam({ name: 'code', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Permission retrieved',
    type: PermissionEntity,
  })
  async findByCode(@Param('code') code: string): Promise<PermissionEntity> {
    return this.permissionsService.findByCode(code);
  }

  @Patch(':id')
  @RequirePlatformOperator()
  @RequirePermission('roles:update')
  @ApiOperation({ summary: 'Update a permission' })
  @ApiBody({ type: UpdatePermissionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Permission updated',
    type: PermissionEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PermissionEntity> {
    return this.permissionsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePlatformOperator()
  @RequirePermission('roles:delete')
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Permission deleted',
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.permissionsService.delete(id, user.userId);
  }
}
