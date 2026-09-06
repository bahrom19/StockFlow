import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated notifications' })
  async findAll(
    @Query() query: NotificationQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.notificationsService.listForUser(
      currentUser.companyId,
      currentUser.userId,
      {
        page,
        limit,
        unreadOnly: query.unreadOnly,
        type: query.type,
      },
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Unread count' })
  async getUnreadCount(
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ count: number }> {
    const count = await this.notificationsService.unreadCountForUser(
      currentUser.companyId,
      currentUser.userId,
    );
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', type: 'string', description: 'Notification UUID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notification marked as read' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Notification not found or not owned by user' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ success: boolean }> {
    const updated = await this.notificationsService.markRead(
      currentUser.companyId,
      currentUser.userId,
      id,
    );
    return { success: updated };
  }
}
