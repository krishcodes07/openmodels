import { Router, Request, Response } from 'express';
import { providerRegistry } from '../../providers/registry';
import { optionalAuthenticate } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';

const router = Router();

router.use(optionalAuthenticate);

// GET /api/providers - List all providers
router.get('/', (_req: Request, res: Response) => {
  const providers = providerRegistry.getAllInfo();
  res.json({ providers });
});

// GET /api/providers/:id/models - List models for a provider
router.get('/:id/models', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const provider = providerRegistry.get(id);

    if (!provider) {
      res.status(404).json({ error: `Provider '${id}' not found` });
      return;
    }

    // Get user's API key for this provider
    let userApiKey: string | undefined;
    if (req.user) {
      const storedKey = await prisma.userApiKey.findUnique({
        where: {
          userId_providerId: {
            userId: req.user.userId,
            providerId: id,
          },
        },
      });

      if (storedKey) {
        userApiKey = decrypt(storedKey.encryptedKey, storedKey.iv, storedKey.authTag);
      }
    }

    const models = await provider.listModels(userApiKey);
    res.json({ models });
  } catch (error) {
    console.error('[Providers] List models error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

export default router;
