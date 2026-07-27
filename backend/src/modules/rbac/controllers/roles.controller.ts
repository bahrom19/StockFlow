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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleEntity } from '../entities/role.entity';
import { RolesGuard } from '../guards/roles.guard';
import { RolesService } from '../services/roles.service';

@ApiTags('rbac / roles')
@Controller('rbac/roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('roles:create')
  @ApiOperation({ summary: 'Create a new role (scoped to current company)' })
  @ApiBody({ type: CreateRoleDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Role created',
    type: RoleEntity,
  })
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<RoleEntity> {
    return this.rolesService.create(dto, currentUser.companyId);
  }

  @Get()
  @RequirePermission('roles:read')
  @ApiOperation({ summary: 'List roles for the current company' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: HttpStatus.OK, description: 'Roles retrieved' })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isActive') isActive?: string,
  ): Promise<{
    items: ReturnType<typeof RoleEntity.fromPrisma>[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.rolesService.findAll(currentUser.companyId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('roles:read')
  @ApiOperation({ summary: 'Get a role by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Role retrieved',
    type: RoleEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<RoleEntity> {
    return this.rolesService.findById(id, currentUser.companyId);
  }

  @Patch(':id')
  @RequirePermission('roles:update')
  @ApiOperation({ summary: 'Update a role' })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Role updated',
    type: RoleEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<RoleEntity> {
    return this.rolesService.update(id, dto, currentUser.companyId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('roles:delete')
  @ApiOperation({ summary: 'Soft delete a role' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Role soft deleted',
  })
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    return this.rolesService.softDelete(id, currentUser.companyId);
  }

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('roles:assign')
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiBody({ type: AssignRoleDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Role assigned' })
  async assignRoleToUser(
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ message: string }> {
    await this.rolesService.assignRoleToUser(dto, currentUser.companyId);
    return { message: 'Role assigned successfully' };
  }

  @Post('unassign')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('roles:assign')
  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiBody({ type: AssignRoleDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Role removed' })
  async removeRoleFromUser(
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ message: string }> {
    await this.rolesService.removeRoleFromUser(dto, currentUser.companyId);
    return { message: 'Role unassigned successfully' };
  }

  @Get('users/list')
  @RequirePermission('roles:read')
  @ApiOperation({ summary: 'List all users with their role assignments' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users with roles retrieved',
  })
  async findUsersByCompany(
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ userId: string; roleIds: string[] }[]> {
    return this.rolesService.findUsersByCompany(currentUser.companyId);
  }
}
