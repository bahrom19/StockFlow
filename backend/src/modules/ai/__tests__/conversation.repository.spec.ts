import { ConversationRepository } from '../repositories/conversation.repository';
import { PrismaService } from '../../../common/prisma';

describe('ConversationRepository — tenant isolation, CRUD, message ordering', () => {
  let repo: ConversationRepository;
  let prisma: {
    aiConversation: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      deleteMany: jest.Mock;
      updateMany: jest.Mock;
    };
    aiMessage: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  const companyId = 'company-1';
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const otherCompanyId = 'company-2';

  beforeEach(() => {
    prisma = {
      aiConversation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
      },
      aiMessage: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    repo = new ConversationRepository(prisma as unknown as PrismaService);
  });

  describe('createConversation', () => {
    it('creates conversation with companyId and userId from SecurityContext', async () => {
      const conversation = {
        id: 'conv-1',
        companyId,
        userId,
        title: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.aiConversation.create.mockResolvedValue(conversation);

      const result = await repo.createConversation(companyId, userId, 'Test');

      expect(prisma.aiConversation.create).toHaveBeenCalledWith({
        data: {
          companyId,
          userId,
          title: 'Test',
        },
      });
      expect(result).toEqual(conversation);
    });

    it('creates conversation with null title when not provided', async () => {
      prisma.aiConversation.create.mockResolvedValue({ id: 'conv-1' });

      await repo.createConversation(companyId, userId);

      expect(prisma.aiConversation.create).toHaveBeenCalledWith({
        data: {
          companyId,
          userId,
          title: null,
        },
      });
    });
  });

  describe('findConversationByIdForUser', () => {
    it('returns conversation when owned by the same user and company', async () => {
      const conversation = { id: 'conv-1', companyId, userId };
      prisma.aiConversation.findFirst.mockResolvedValue(conversation);

      const result = await repo.findConversationByIdForUser(
        'conv-1',
        companyId,
        userId,
      );

      expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-1',
          companyId,
          userId,
        },
      });
      expect(result).toEqual(conversation);
    });

    it('returns null when conversation belongs to another user (same company)', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.findConversationByIdForUser(
        'conv-1',
        companyId,
        otherUserId,
      );

      expect(result).toBeNull();
    });

    it('returns null when conversation belongs to another company', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.findConversationByIdForUser(
        'conv-1',
        otherCompanyId,
        userId,
      );

      expect(result).toBeNull();
    });
  });

  describe('listConversations', () => {
    it('returns conversations with message count, ordered by updatedAt desc', async () => {
      const conversations = [
        {
          id: 'conv-1',
          title: 'First',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { messages: 5 },
        },
        {
          id: 'conv-2',
          title: 'Second',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { messages: 3 },
        },
      ];
      prisma.aiConversation.findMany.mockResolvedValue(conversations);
      prisma.aiConversation.count.mockResolvedValue(2);

      const result = await repo.listConversations(companyId, userId);

      expect(prisma.aiConversation.findMany).toHaveBeenCalledWith({
        where: { companyId, userId },
        include: { _count: { select: { messages: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]!.messageCount).toBe(5);
      expect(result.total).toBe(2);
    });

    it('supports pagination', async () => {
      prisma.aiConversation.findMany.mockResolvedValue([]);
      prisma.aiConversation.count.mockResolvedValue(25);

      const result = await repo.listConversations(companyId, userId, 2, 10);

      expect(prisma.aiConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  describe('deleteConversation', () => {
    it('deletes own conversation', async () => {
      prisma.aiConversation.deleteMany.mockResolvedValue({ count: 1 });

      const result = await repo.deleteConversation(
        'conv-1',
        companyId,
        userId,
      );

      expect(prisma.aiConversation.deleteMany).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId, userId },
      });
      expect(result).toBe(true);
    });

    it('returns false when trying to delete another users conversation', async () => {
      prisma.aiConversation.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repo.deleteConversation(
        'conv-1',
        companyId,
        otherUserId,
      );

      expect(result).toBe(false);
    });

    it('returns false when trying to delete another companys conversation', async () => {
      prisma.aiConversation.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repo.deleteConversation(
        'conv-1',
        otherCompanyId,
        userId,
      );

      expect(result).toBe(false);
    });
  });

  describe('createMessage', () => {
    it('creates message with role and content when conversation is owned', async () => {
      // Verify ownership first
      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      const message = {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date(),
      };
      prisma.aiMessage.create.mockResolvedValue(message);

      const result = await repo.createMessage('conv-1', companyId, userId, 'user', 'Hello');

      expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId, userId },
        select: { id: true },
      });
      expect(prisma.aiMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          role: 'user',
          content: 'Hello',
          toolCallsJson: undefined,
          toolCallId: undefined,
          toolName: undefined,
          tokenCount: undefined,
        },
      });
      expect(result).toEqual(message);
    });

    it('creates assistant message with tool calls when conversation is owned', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      prisma.aiMessage.create.mockResolvedValue({ id: 'msg-2' });

      await repo.createMessage('conv-1', companyId, userId, 'assistant', 'Response', {
        toolCallsJson: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
        tokenCount: 150,
      });

      expect(prisma.aiMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Response',
          toolCallsJson: [{ id: 'tc-1', name: 'get_dashboard', arguments: {} }],
          toolCallId: undefined,
          toolName: undefined,
          tokenCount: 150,
        },
      });
    });

    it('creates tool result message when conversation is owned', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      prisma.aiMessage.create.mockResolvedValue({ id: 'msg-3' });

      await repo.createMessage('conv-1', companyId, userId, 'tool', '{"result": "data"}', {
        toolCallId: 'tc-1',
        toolName: 'get_dashboard',
      });

      expect(prisma.aiMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          role: 'tool',
          content: '{"result": "data"}',
          toolCallsJson: undefined,
          toolCallId: 'tc-1',
          toolName: 'get_dashboard',
          tokenCount: undefined,
        },
      });
    });

    it('returns null when conversation belongs to another user (same company)', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.createMessage(
        'conv-1', companyId, otherUserId, 'user', 'Injected message',
      );

      expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId, userId: otherUserId },
        select: { id: true },
      });
      expect(prisma.aiMessage.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('returns null when conversation belongs to another company', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.createMessage(
        'conv-1', otherCompanyId, userId, 'user', 'Injected message',
      );

      expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId: otherCompanyId, userId },
        select: { id: true },
      });
      expect(prisma.aiMessage.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('listMessages', () => {
    it('returns messages ordered by createdAt DESC (newest first, AI-7)', async () => {
      // First verify ownership
      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });

      const messages = [
        { id: 'msg-2', role: 'assistant', content: 'Hi', createdAt: new Date('2026-09-07T10:00:01Z') },
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date('2026-09-07T10:00:00Z') },
      ];
      prisma.aiMessage.findMany.mockResolvedValue(messages);

      const result = await repo.listMessages('conv-1', companyId, userId);

      expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId, userId },
        select: { id: true },
      });
      expect(prisma.aiMessage.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      expect(result).toEqual(messages);
    });

    it('returns null when conversation not found or not owned', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.listMessages(
        'conv-1',
        companyId,
        otherUserId,
      );

      expect(result).toBeNull();
      expect(prisma.aiMessage.findMany).not.toHaveBeenCalled();
    });

    it('respects limit parameter', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      prisma.aiMessage.findMany.mockResolvedValue([]);

      await repo.listMessages('conv-1', companyId, userId, 10);

      expect(prisma.aiMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('countMessages', () => {
    it('counts messages for own conversation', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
      prisma.aiMessage.count.mockResolvedValue(5);

      const result = await repo.countMessages('conv-1', companyId, userId);

      expect(result).toBe(5);
    });

    it('returns 0 when conversation not owned', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.countMessages(
        'conv-1',
        companyId,
        otherUserId,
      );

      expect(result).toBe(0);
      expect(prisma.aiMessage.count).not.toHaveBeenCalled();
    });
  });

  describe('updateConversation', () => {
    it('updates title and bumps updatedAt', async () => {
      prisma.aiConversation.updateMany.mockResolvedValue({ count: 1 });

      await repo.updateConversation('conv-1', companyId, userId, {
        title: 'New Title',
      });

      expect(prisma.aiConversation.updateMany).toHaveBeenCalledWith({
        where: { id: 'conv-1', companyId, userId },
        data: {
          title: 'New Title',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('does not update when conversation not owned', async () => {
      prisma.aiConversation.updateMany.mockResolvedValue({ count: 0 });

      await repo.updateConversation('conv-1', companyId, otherUserId, {
        title: 'Hacked',
      });

      expect(prisma.aiConversation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1', companyId, userId: otherUserId },
        }),
      );
    });
  });

  describe('tenant isolation — comprehensive', () => {
    it('cross-user access: findConversationByIdForUser returns null', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.findConversationByIdForUser(
        'conv-1',
        companyId,
        otherUserId,
      );

      expect(result).toBeNull();
    });

    it('cross-company access: findConversationByIdForUser returns null', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.findConversationByIdForUser(
        'conv-1',
        otherCompanyId,
        userId,
      );

      expect(result).toBeNull();
    });

    it('cross-user delete: returns false', async () => {
      prisma.aiConversation.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repo.deleteConversation(
        'conv-1',
        companyId,
        otherUserId,
      );

      expect(result).toBe(false);
    });

    it('cross-company delete: returns false', async () => {
      prisma.aiConversation.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repo.deleteConversation(
        'conv-1',
        otherCompanyId,
        userId,
      );

      expect(result).toBe(false);
    });

    it('cross-user message listing: returns null', async () => {
      prisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await repo.listMessages(
        'conv-1',
        companyId,
        otherUserId,
      );

      expect(result).toBeNull();
    });
  });
});
