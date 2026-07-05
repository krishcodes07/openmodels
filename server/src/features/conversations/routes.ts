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
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        providerId: true,
        modelId: true,
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
    const { title, providerId, modelId } = req.body;

    const conversation = await prisma.conversation.create({
      data: {
        title: title || 'New Chat',
        providerId: providerId || 'nvidia',
        modelId: modelId || 'meta/llama-3.3-70b-instruct',
        userId: req.user!.userId,
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
    const { title, providerId, modelId } = req.body;

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

export default router;
