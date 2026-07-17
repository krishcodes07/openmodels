import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/conversations
router.get('/', async (req: Request, res: Response) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user!.userId },
      orderBy: [
        { isPinned: 'desc' },
        { updatedAt: 'desc' }
      ],
      select: {
        id: true,
        title: true,
        providerId: true,
        modelId: true,
        isPinned: true,
        personaId: true,
        persona: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          }
        },
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    res.json({ conversations });
  } catch (error) {
    console.error('[Conversations] List error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: req.user!.userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        persona: true,
      },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ conversation });
  } catch (error) {
    console.error('[Conversations] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/conversations
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, providerId, modelId, personaId } = req.body;

    const conversation = await prisma.conversation.create({
      data: {
        title: title || 'New Chat',
        providerId: providerId || 'nvidia',
        modelId: modelId || 'meta/llama-3.3-70b-instruct',
        userId: req.user!.userId,
        personaId: personaId || null,
      },
    });

    res.status(201).json({ conversation });
  } catch (error) {
    console.error('[Conversations] Create error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// PATCH /api/conversations/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, providerId, modelId, isPinned } = req.body;

    const existing = await prisma.conversation.findFirst({
      where: { id, userId: req.user!.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(providerId !== undefined && { providerId }),
        ...(modelId !== undefined && { modelId }),
        ...(isPinned !== undefined && { isPinned }),
      },
    });

    res.json({ conversation });
  } catch (error) {
    console.error('[Conversations] Update error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.conversation.findFirst({
      where: { id, userId: req.user!.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    await prisma.conversation.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Conversations] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// POST /api/conversations/:id/messages - Add a message directly to DB (e.g. stopped response)
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { role, content, thinkingContent, parentMessageId, userContent } = req.body;

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: req.user!.userId },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        role: role || 'ASSISTANT',
        content: content || '',
        thinkingContent: thinkingContent || null,
        parentMessageId: parentMessageId || null,
        userContent: userContent || null,
      },
    });

    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error('[Conversations] Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

export default router;
