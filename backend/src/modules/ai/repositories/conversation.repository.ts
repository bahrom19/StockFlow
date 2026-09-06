import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

/**
 * ConversationRepository — data access for AI conversations and messages.
 *
 * SECURITY RULES:
 * - Every query is scoped by companyId AND userId
 * - conversationId is NEVER sufficient for access
 * - Cross-user / cross-company access returns null / empty
 * - DELETE uses the same tenant/user filter
 */
@Injectable()
export class ConversationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  /**
   * Create a new conversation.
   * companyId and userId come from SecurityContext, never from client.
   */
  async createConversation(
    companyId: string,
    userId: string,
    title?: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.getClient(tx).aiConversation.create({
      data: {
        companyId,
        userId,
        title: title ?? null,
      },
    });
  }

  /**
   * Find a conversation by ID, scoped to the owning user and company.
   * Returns null if not found or if owned by another user/company.
   */
  async findConversationByIdForUser(
    conversationId: string,
    companyId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.getClient(tx).aiConversation.findFirst({
      where: {
        id: conversationId,
        companyId,
        userId,
      },
    });
  }

  /**
   * List conversations for a user, ordered by most recent first.
   * Includes message count via _count.
   */
  async listConversations(
    companyId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
    tx?: Prisma.TransactionClient,
  ) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.getClient(tx).aiConversation.findMany({
        where: {
          companyId,
          userId,
        },
        include: {
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.getClient(tx).aiConversation.count({
        where: {
          companyId,
          userId,
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        messageCount: item._count.messages,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Delete a conversation and all its messages (cascade).
   * Scoped to the owning user and company.
   * Returns true if deleted, false if not found / not authorized.
   */
  async deleteConversation(
    conversationId: string,
    companyId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const result = await this.getClient(tx).aiConversation.deleteMany({
      where: {
        id: conversationId,
        companyId,
        userId,
      },
    });

    return result.count > 0;
  }

  /**
   * Create a message in a conversation.
   * Verifies conversation ownership before inserting.
   * Returns null if conversation not found or not owned.
   */
  async createMessage(
    conversationId: string,
    companyId: string,
    userId: string,
    role: 'user' | 'assistant' | 'tool',
    content: string,
    options?: {
      toolCallsJson?: Prisma.InputJsonValue;
      toolCallId?: string;
      toolName?: string;
      tokenCount?: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    // Verify ownership before inserting
    const conversation = await this.getClient(tx).aiConversation.findFirst({
      where: {
        id: conversationId,
        companyId,
        userId,
      },
      select: { id: true },
    });

    if (!conversation) {
      return null; // Not found or not authorized
    }

    return this.getClient(tx).aiMessage.create({
      data: {
        conversationId,
        role,
        content,
        toolCallsJson: options?.toolCallsJson ?? undefined,
        toolCallId: options?.toolCallId ?? undefined,
        toolName: options?.toolName ?? undefined,
        tokenCount: options?.tokenCount ?? undefined,
      },
    });
  }

  /**
   * List messages for a conversation, ordered by creation time ASC.
   * Scoped to the owning user and company via conversation lookup.
   */
  async listMessages(
    conversationId: string,
    companyId: string,
    userId: string,
    limit: number = 20,
    tx?: Prisma.TransactionClient,
  ) {
    // First verify ownership
    const conversation = await this.getClient(tx).aiConversation.findFirst({
      where: {
        id: conversationId,
        companyId,
        userId,
      },
      select: { id: true },
    });

    if (!conversation) {
      return null; // Not found or not authorized
    }

    const messages = await this.getClient(tx).aiMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages;
  }

  /**
   * Count messages in a conversation.
   * Scoped to the owning user and company.
   */
  async countMessages(
    conversationId: string,
    companyId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    // Verify ownership first
    const conversation = await this.getClient(tx).aiConversation.findFirst({
      where: {
        id: conversationId,
        companyId,
        userId,
      },
      select: { id: true },
    });

    if (!conversation) {
      return 0;
    }

    return this.getClient(tx).aiMessage.count({
      where: {
        conversationId,
      },
    });
  }

  /**
   * Update conversation title and timestamp.
   */
  async updateConversation(
    conversationId: string,
    companyId: string,
    userId: string,
    data: { title?: string },
    tx?: Prisma.TransactionClient,
  ) {
    return this.getClient(tx).aiConversation.updateMany({
      where: {
        id: conversationId,
        companyId,
        userId,
      },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }
}
