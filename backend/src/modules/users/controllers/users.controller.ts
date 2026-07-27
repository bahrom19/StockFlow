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
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';

@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('users:create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully',
    type: UserEntity,
  })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserEntity> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequirePermission('users:read')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
    type: [UserEntity],
  })
  async findAll(@CurrentUser() currentUser: JwtPayload): Promise<UserEntity[]> {
    return this.usersService.findAll(currentUser);
  }

  @Get(':id')
  @RequirePermission('users:read')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
    type: UserEntity,
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserEntity> {
    return this.usersService.findById(id, currentUser);
  }

  @Get('email/:email')
  @RequirePermission('users:read')
  @ApiOperation({ summary: 'Get a user by email' })
  @ApiParam({ name: 'email', type: 'string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
    type: UserEntity,
  })
  async findByEmail(
    @Param('email') email: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserEntity> {
    return this.usersService.findByEmail(email, currentUser);
  }

  @Patch(':id')
  @RequirePermission('users:update')
  @ApiOperation({ summary: 'Update a user' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
    type: UserEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserEntity> {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('users:delete')
  @ApiOperation({ summary: 'Soft delete a user' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User soft-deleted successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    await this.usersService.softDelete(id, currentUser);
  }
}
