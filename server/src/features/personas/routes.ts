import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';

const router = Router();

// GET /api/personas - Fetch system and user-defined personas
router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const personas = await prisma.persona.findMany({
      where: {
        OR: [
          { userId: null }, // System/Pre-built personas
          ...(userId ? [{ userId }] : []), // User's own custom personas
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    res.json({ personas });
  } catch (error: any) {
    console.error('[Personas] Error fetching personas:', error);
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

// POST /api/personas - Create a new user-defined persona
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, description, systemPrompt, imageUrl } = req.body;

    if (!name || !description || !systemPrompt) {
      res.status(400).json({ error: 'name, description, and systemPrompt are required' });
      return;
    }

    const newPersona = await prisma.persona.create({
      data: {
        name,
        description,
        systemPrompt,
        imageUrl: imageUrl || null,
        userId: req.user!.userId,
      },
    });

    res.status(219).json({ persona: newPersona });
  } catch (error: any) {
    console.error('[Personas] Error creating persona:', error);
    res.status(500).json({ error: 'Failed to create persona' });
  }
});

// DELETE /api/personas/:id - Delete a user-defined persona
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const persona = await prisma.persona.findUnique({
      where: { id: id as string },
    });

    if (!persona) {
      res.status(404).json({ error: 'Persona not found' });
      return;
    }

    if (persona.userId !== req.user!.userId) {
      res.status(403).json({ error: 'You are not authorized to delete this persona' });
      return;
    }

    await prisma.persona.delete({
      where: { id: id as string },
    });

    res.json({ success: true, message: 'Persona deleted successfully' });
  } catch (error: any) {
    console.error('[Personas] Error deleting persona:', error);
    res.status(500).json({ error: 'Failed to delete persona' });
  }
});

export default router;
