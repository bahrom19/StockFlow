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
import { TaskService } from '../services/task.service';
import { TaskEntity } from '../entities/task.entity';
import { CreateTaskDto, UpdateTaskDto, TaskQueryDto } from '../dto/task.dto';

@ApiTags('crm / tasks')
@Controller('crm/tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaskController {
  constructor(private readonly service: TaskService) {}

  @Post()
  @RequirePermission('crm:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task' })
  @ApiResponse({ status: HttpStatus.CREATED, type: TaskEntity })
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TaskEntity> {
    return this.service.create(dto, user.companyId, user.userId);
  }

  @Get()
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'List tasks' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(@Query() query: TaskQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.findAll(query, user.companyId);
  }

  @Get(':id')
  @RequirePermission('crm:read')
  @ApiOperation({ summary: 'Get task by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, type: TaskEntity })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TaskEntity> {
    return this.service.findOne(id, user.companyId);
  }

  @Patch(':id')
  @RequirePermission('crm:update')
  @ApiOperation({ summary: 'Update task' })
  @ApiBody({ type: UpdateTaskDto })
  @ApiResponse({ status: HttpStatus.OK, type: TaskEntity })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TaskEntity> {
    return this.service.update(id, dto, user.companyId, user.userId);
  }

  @Delete(':id')
  @RequirePermission('crm:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete task' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.remove(id, user.companyId, user.userId);
  }
}
