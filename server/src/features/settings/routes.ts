import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { encrypt, decrypt } from '../../lib/encryption';

const router = Router();

router.use(authenticate);

// GET /api/settings - Get user settings
router.get('/', async (req: Request, res: Response) => {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.user!.userId },
      });
    }

    res.json({ settings });
  } catch (error) {
    console.error('[Settings] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PATCH /api/settings - Update user settings
router.patch('/', async (req: Request, res: Response) => {
  try {
    const { defaultProviderId, defaultModelId, theme, systemPrompt } = req.body;

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user!.userId },
      update: {
        ...(defaultProviderId !== undefined && { defaultProviderId }),
        ...(defaultModelId !== undefined && { defaultModelId }),
        ...(theme !== undefined && { theme }),
        ...(systemPrompt !== undefined && { systemPrompt }),
      },
      create: {
        userId: req.user!.userId,
        defaultProviderId,
        defaultModelId,
        theme,
        systemPrompt,
      },
    });

    res.json({ settings });
  } catch (error) {
    console.error('[Settings] Update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/settings/api-keys - List configured API keys (masked)
router.get('/api-keys', async (req: Request, res: Response) => {
  try {
    const keys = await prisma.userApiKey.findMany({
      where: { userId: req.user!.userId },
      select: {
        id: true,
        providerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return provider IDs that have keys configured (don't expose actual keys)
    const configuredProviders = keys.map(k => ({
      id: k.id,
      providerId: k.providerId,
      configured: true,
      updatedAt: k.updatedAt,
    }));

    res.json({ apiKeys: configuredProviders });
  } catch (error) {
    console.error('[Settings] List API keys error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// PUT /api/settings/api-keys/:providerId - Save/update API key for a provider
router.put('/api-keys/:providerId', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    const providerId = req.params.providerId as string;

    if (!apiKey) {
      res.status(400).json({ error: 'API key is required' });
      return;
    }

    const { encrypted, iv, authTag } = encrypt(apiKey);

    await prisma.userApiKey.upsert({
      where: {
        userId_providerId: {
          userId: req.user!.userId,
          providerId,
        },
      },
      update: {
        encryptedKey: encrypted,
        iv,
        authTag,
      },
      create: {
        userId: req.user!.userId,
        providerId,
        encryptedKey: encrypted,
        iv,
        authTag,
      },
    });

    res.json({ success: true, providerId });
  } catch (error) {
    console.error('[Settings] Save API key error:', error);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// DELETE /api/settings/api-keys/:providerId - Delete API key for a provider
router.delete('/api-keys/:providerId', async (req: Request, res: Response) => {
  try {
    const providerId = req.params.providerId as string;

    await prisma.userApiKey.deleteMany({
      where: {
        userId: req.user!.userId,
        providerId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Settings] Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// GET /api/settings/api-keys/:providerId/verify - Verify an API key works
router.get('/api-keys/:providerId/verify', async (req: Request, res: Response) => {
  try {
    const providerId = req.params.providerId as string;

    const storedKey = await prisma.userApiKey.findUnique({
      where: {
        userId_providerId: {
          userId: req.user!.userId,
          providerId,
        },
      },
    });

    if (!storedKey) {
      res.json({ configured: false });
      return;
    }

    // Just check that the key exists and can be decrypted
    try {
      decrypt(storedKey.encryptedKey, storedKey.iv, storedKey.authTag);
      res.json({ configured: true, providerId });
    } catch {
      res.json({ configured: false, error: 'Key corrupted' });
    }
  } catch (error) {
    console.error('[Settings] Verify API key error:', error);
    res.status(500).json({ error: 'Failed to verify API key' });
  }
});

// GET /api/settings/usage - Get user usage & analytics stats
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // 1. Total chats
    const totalChats = await prisma.conversation.count({
      where: { userId },
    });

    // 2. Aggregate logs
    const logs = await prisma.usageLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    let totalTokensSpent = 0;
    let totalWebSearches = 0;
    const providerStats: Record<string, { total: number; models: Record<string, number> }> = {};

    for (const log of logs) {
      totalTokensSpent += log.totalTokens;
      if (log.webSearch) {
        totalWebSearches++;
      }

      if (!providerStats[log.providerId]) {
        providerStats[log.providerId] = { total: 0, models: {} };
      }
      providerStats[log.providerId].total += log.totalTokens;

      if (!providerStats[log.providerId].models[log.modelId]) {
        providerStats[log.providerId].models[log.modelId] = 0;
      }
      providerStats[log.providerId].models[log.modelId] += log.totalTokens;
    }

    res.json({
      stats: {
        totalChats,
        totalTokensSpent,
        totalWebSearches,
        providerStats,
      },
      logs: logs.slice(0, 100), // return last 100 logs for history list
    });
  } catch (error) {
    console.error('[Settings] Usage fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch usage analytics' });
  }
});

export default router;
