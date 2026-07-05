import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';
import { providerRegistry } from '../../providers/registry';
import { decrypt } from '../../lib/encryption';
import { ChatMessage } from '../../providers/base.provider';
import { config } from '../../config';
import { searchWeb, getFirecrawlApiKey } from '../../lib/search';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer storage in memory
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, webp, gif) are allowed'));
    }
  },
});

// POST /api/chat/upload - Upload file(s)/image(s) — supports multiple files
router.post('/upload', optionalAuthenticate, upload.array('files', 10), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }
    const urls = files.map(f => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`);
    res.json({ urls });
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// Generate AI title for a conversation using the same provider
async function generateTitle(providerId: string, modelId: string, userMessage: string, apiKey?: string): Promise<string> {
  try {
    const provider = providerRegistry.get(providerId);
    if (!provider) return userMessage.substring(0, 60);

    const platformKey = (config.providers as any)[providerId]?.apiKey || '';
    const key = apiKey || platformKey;
    if (!key) return userMessage.substring(0, 60);

    const response = await provider.chat({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: 'Generate a very short title (3-6 words max) for this conversation. Return ONLY the title text, nothing else. No quotes, no explanations.',
        },
        { role: 'user', content: userMessage.substring(0, 500) },
      ],
      maxTokens: 30,
      temperature: 0.5,
    }, key);

    const title = response.content.trim().replace(/^["']|["']$/g, '').substring(0, 80);
    return title || userMessage.substring(0, 60);
  } catch (err) {
    console.error('[Chat] Title generation failed:', err);
    return userMessage.substring(0, 60);
  }
}

// POST /api/chat
router.post('/', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const { conversationId, message, providerId, modelId, thinking, webSearch, imageUrls } = req.body;

    if (!message || !providerId || !modelId) {
      res.status(400).json({ error: 'message, providerId, and modelId are required' });
      return;
    }

    const provider = providerRegistry.get(providerId);
    if (!provider) {
      res.status(400).json({ error: `Provider '${providerId}' not found` });
      return;
    }

    // Get user's API key for this provider if authenticated
    let userApiKey: string | undefined;
    if (req.user) {
      const storedKey = await prisma.userApiKey.findUnique({
        where: {
          userId_providerId: {
            userId: req.user.userId,
            providerId,
          },
        },
      });

      if (storedKey) {
        userApiKey = decrypt(storedKey.encryptedKey, storedKey.iv, storedKey.authTag);
      }
    }

    // Check if using server key
    const platformKey = (config.providers as any)[providerId]?.apiKey || '';
    const usingServerKey = !userApiKey && !!platformKey;

    // Get or create conversation (only if authenticated)
    let conversation;
    let isNewConversation = false;
    let boundConversationId = conversationId || 'temp-' + Date.now();
    let userMsgId = 'temp-' + Date.now();

    if (req.user) {
      if (conversationId) {
        conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, userId: req.user.userId },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        });

        if (!conversation) {
          res.status(404).json({ error: 'Conversation not found' });
          return;
        }
      } else {
        // Create new conversation
        isNewConversation = true;
        const initialTitle = message.substring(0, 100).trim() || 'New Chat';
        conversation = await prisma.conversation.create({
          data: {
            title: initialTitle,
            providerId,
            modelId,
            userId: req.user.userId,
          },
          include: { messages: true },
        });
      }
      boundConversationId = conversation.id;
    }

    // Set up SSE headers early so asynchronous tasks (like parallel title generation) can safely call res.write()
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Conversation-Id', boundConversationId);

    // Generate AI title for new conversations (start early in parallel)
    let titlePromise: Promise<string> | undefined;
    const isNew = req.user ? isNewConversation : (!req.body.messages || req.body.messages.length <= 1);
    if (isNew) {
      titlePromise = generateTitle(providerId, modelId, message, userApiKey).then(async (title) => {
        try {
          if (req.user) {
            await prisma.conversation.update({
              where: { id: boundConversationId },
              data: { title },
            });
          }
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'title', title, conversationId: boundConversationId })}\n\n`);
          }
          return title;
        } catch (e) {
          console.error('[Chat] Failed to update title:', e);
          return message.substring(0, 60);
        }
      });
    }

    // Save user message (only if authenticated)
    if (req.user) {
      const userMsg = await prisma.message.create({
        data: {
          conversationId: boundConversationId,
          role: 'USER',
          content: message,
          imageUrls: imageUrls || [],
        },
      });
      userMsgId = userMsg.id;
    }

    // Handle web search if requested
    let finalUserMessage = message;
    if (webSearch) {
      try {
        // Get user's Firecrawl API key if they have one
        let userFirecrawlKey: string | undefined;
        if (req.user) {
          const storedFcKey = await prisma.userApiKey.findUnique({
            where: {
              userId_providerId: {
                userId: req.user.userId,
                providerId: 'firecrawl',
              },
            },
          });
          if (storedFcKey) {
            userFirecrawlKey = decrypt(storedFcKey.encryptedKey, storedFcKey.iv, storedFcKey.authTag);
          }
        }

        // Build conversation history for query generation
        let historyForSearch = [];
        if (req.user && conversation) {
          historyForSearch = conversation.messages.map(m => ({
            role: m.role.toLowerCase(),
            content: m.content,
          }));
        } else if (req.body.messages) {
          historyForSearch = req.body.messages.map((m: any) => ({
            role: m.role.toLowerCase(),
            content: m.content,
          }));
        }

        const searchContext = await searchWeb(
          message,
          historyForSearch,
          providerId,
          modelId,
          userApiKey,
          userFirecrawlKey
        );
        finalUserMessage = `[Web Search Results]\n${searchContext}\n\n[User Query]\n${message}`;

        // Extract source URLs from search context for the Sources sidebar
        const sourceLines = searchContext.split('\n');
        const sources: { title: string; url: string; description: string }[] = [];
        let currentSource: any = {};
        for (const line of sourceLines) {
          if (line.startsWith('Title: ')) currentSource.title = line.substring(7);
          if (line.startsWith('URL: ')) currentSource.url = line.substring(5);
          if (line.startsWith('Content:')) {
            currentSource.description = '';
          } else if (currentSource.description !== undefined && !line.startsWith('[Source') && !line.startsWith('---') && !line.startsWith('Title:') && !line.startsWith('URL:') && !line.startsWith('Search queries')) {
            currentSource.description = (currentSource.description + ' ' + line).trim().substring(0, 200);
          }
          if (line.startsWith('---') || line.startsWith('[Source')) {
            if (currentSource.url) sources.push({ ...currentSource });
            currentSource = {};
          }
        }
        if (currentSource.url) sources.push(currentSource);

        // Send sources to frontend
        (res as any).sourcesJson = JSON.stringify(sources);
      } catch (err) {
        console.error('[Chat] Web search execution error:', err);
      }
    }

    // Fetch user settings to get custom system instruction prompt
    let systemPrompt: string | undefined;
    if (req.user) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: req.user.userId },
      });
      systemPrompt = settings?.systemPrompt || undefined;
    }

    // Build message history
    const chatMessages: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      chatMessages.push({
        role: 'system' as const,
        content: systemPrompt.trim(),
        imageUrls: [],
      });
    }

    if (req.user && conversation) {
      chatMessages.push(
        ...conversation.messages.map(m => ({
          role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
          content: m.content,
          imageUrls: m.imageUrls || [],
        }))
      );
    } else if (req.body.messages) {
      chatMessages.push(
        ...req.body.messages.map((m: any) => ({
          role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
          content: m.content,
          imageUrls: m.imageUrls || [],
        }))
      );
    }

    chatMessages.push(
      { role: 'user' as const, content: finalUserMessage, imageUrls: imageUrls || [] }
    );

    // SSE headers are already set early in the request lifecycle

    // Send usingServerKey flag right away
    if (usingServerKey) {
      res.write(`data: ${JSON.stringify({ type: 'info', usingServerKey: true })}\n\n`);
    }

    // Send sources if web search produced them
    if ((res as any).sourcesJson) {
      res.write(`data: ${JSON.stringify({ type: 'sources', sources: JSON.parse((res as any).sourcesJson) })}\n\n`);
    }

    let fullContent = '';
    let thinkingContent = '';

    try {
      await provider.streamChat(
        {
          model: modelId,
          messages: chatMessages,
          thinking,
          webSearch,
          stream: true,
        },
        (chunk) => {
          if (res.destroyed || res.writableEnded) {
            throw new Error('Client disconnected');
          }
          if (chunk.content) {
            fullContent += chunk.content;
            res.write(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`);
          }
          if (chunk.thinkingContent) {
            thinkingContent += chunk.thinkingContent;
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: chunk.thinkingContent })}\n\n`);
          }
        },
        userApiKey
      );

      // Save assistant message — always to the original conversation (only if authenticated)
      if (req.user) {
        try {
          await prisma.message.create({
            data: {
              conversationId: boundConversationId,
              role: 'ASSISTANT',
              content: fullContent,
              thinkingContent: thinkingContent || null,
              sources: (res as any).sourcesJson || null,
              parentMessageId: userMsgId,
            },
          });

          // Update conversation timestamp
          await prisma.conversation.update({
            where: { id: boundConversationId },
            data: { updatedAt: new Date() },
          });
        } catch (dbErr: any) {
          console.warn('[Chat] Failed to save assistant message or update conversation timestamp (conversation may have been deleted during stream):', dbErr.message);
        }

        // Log usage
        const estimatedTokens = Math.ceil((message.length + fullContent.length) / 4);
        await prisma.usageLog.create({
          data: {
            userId: req.user.userId,
            providerId,
            modelId,
            promptTokens: Math.ceil(message.length / 4),
            completionTokens: Math.ceil(fullContent.length / 4),
            totalTokens: estimatedTokens,
            webSearch: !!webSearch,
          },
        }).catch(e => console.error('[Chat] Usage log failed:', e));

        // Wait for title generation to finish if it's running, to make sure it gets saved and sent before res.end()
        if (titlePromise) {
          await titlePromise.catch(() => {});
        }
      }

      // Send done event now that DB write has finished
      res.write(`data: ${JSON.stringify({ type: 'done', conversationId: boundConversationId })}\n\n`);

    } catch (error: any) {
      if (error.message === 'Client disconnected' || res.destroyed || res.writableEnded) {
        console.log('[Chat] Stream stopped by client. Saving partial response.');
        if (req.user && fullContent.trim()) {
          try {
            await prisma.message.create({
              data: {
                conversationId: boundConversationId,
                role: 'ASSISTANT',
                content: fullContent + ' 🟥 *[Response stopped by user]*',
                thinkingContent: thinkingContent || null,
                sources: (res as any).sourcesJson || null,
                parentMessageId: userMsgId,
              },
            });
            await prisma.conversation.update({
              where: { id: boundConversationId },
              data: { updatedAt: new Date() },
            });
          } catch (dbErr) {
            console.warn('[Chat] Failed to save partial assistant message on disconnect:', dbErr);
          }
        }
        return;
      }
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('[Chat] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed' });
    }
  }
});

// POST /api/chat/regenerate - Regenerate response for a given message
router.post('/regenerate', authenticate, async (req: Request, res: Response) => {
  try {
    const { conversationId, messageId, providerId, modelId, thinking, webSearch } = req.body;

    if (!conversationId || !messageId || !providerId || !modelId) {
      res.status(400).json({ error: 'conversationId, messageId, providerId, and modelId are required' });
      return;
    }

    const provider = providerRegistry.get(providerId);
    if (!provider) {
      res.status(400).json({ error: `Provider '${providerId}' not found` });
      return;
    }

    // Get user API key
    let userApiKey: string | undefined;
    const storedKey = await prisma.userApiKey.findUnique({
      where: { userId_providerId: { userId: req.user!.userId, providerId } },
    });
    if (storedKey) {
      userApiKey = decrypt(storedKey.encryptedKey, storedKey.iv, storedKey.authTag);
    }

    // Get conversation with messages up to and including the target user message
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: req.user!.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Set up SSE headers early
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Find the target user message
    const targetMsgIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (targetMsgIndex === -1) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Build history up to (but excluding) the target message
    const historyMessages = conversation.messages.slice(0, targetMsgIndex);
    const targetMessage = conversation.messages[targetMsgIndex];

    // Handle web search if requested
    let finalUserMessage = targetMessage.content;
    let sourcesJson: string | null = null;
    if (webSearch) {
      try {
        // Get user's Firecrawl API key if they have one
        let userFirecrawlKey: string | undefined;
        const storedFcKey = await prisma.userApiKey.findUnique({
          where: {
            userId_providerId: {
              userId: req.user!.userId,
              providerId: 'firecrawl',
            },
          },
        });
        if (storedFcKey) {
          userFirecrawlKey = decrypt(storedFcKey.encryptedKey, storedFcKey.iv, storedFcKey.authTag);
        }

        // Build conversation history for query generation
        const historyForSearch = historyMessages.map(m => ({
          role: m.role.toLowerCase(),
          content: m.content,
        }));

        const searchContext = await searchWeb(
          targetMessage.content,
          historyForSearch,
          providerId,
          modelId,
          userApiKey,
          userFirecrawlKey
        );
        finalUserMessage = `[Web Search Results]\n${searchContext}\n\n[User Query]\n${targetMessage.content}`;

        // Extract source URLs
        const sourceLines = searchContext.split('\n');
        const sources: { title: string; url: string; description: string }[] = [];
        let currentSource: any = {};
        for (const line of sourceLines) {
          if (line.startsWith('Title: ')) currentSource.title = line.substring(7);
          if (line.startsWith('URL: ')) currentSource.url = line.substring(5);
          if (line.startsWith('Content:')) {
            currentSource.description = '';
          } else if (currentSource.description !== undefined && !line.startsWith('[Source') && !line.startsWith('---') && !line.startsWith('Title:') && !line.startsWith('URL:') && !line.startsWith('Search queries')) {
            currentSource.description = (currentSource.description + ' ' + line).trim().substring(0, 200);
          }
          if (line.startsWith('---') || line.startsWith('[Source')) {
            if (currentSource.url) sources.push({ ...currentSource });
            currentSource = {};
          }
        }
        if (currentSource.url) sources.push(currentSource);

        sourcesJson = JSON.stringify(sources);
      } catch (err) {
        console.error('[Chat] Web search execution error in regenerate:', err);
      }
    }

    // Fetch user settings to get custom system instruction prompt
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user!.userId },
    });
    const systemPrompt = settings?.systemPrompt;

    const chatMessages: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim()) {
      chatMessages.push({
        role: 'system' as const,
        content: systemPrompt.trim(),
        imageUrls: [],
      });
    }

    chatMessages.push(
      ...historyMessages.map(m => ({
        role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: m.content,
        imageUrls: m.imageUrls || [],
      })),
      { role: 'user' as const, content: finalUserMessage, imageUrls: targetMessage.imageUrls || [] }
    );

    // SSE headers are already set early

    // Send sources if web search produced them
    if (sourcesJson) {
      res.write(`data: ${JSON.stringify({ type: 'sources', sources: JSON.parse(sourcesJson) })}\n\n`);
    }

    let fullContent = '';
    let thinkingContent = '';

    try {
      await provider.streamChat(
        { model: modelId, messages: chatMessages, thinking, webSearch, stream: true },
        (chunk) => {
          if (res.destroyed || res.writableEnded) {
            throw new Error('Client disconnected');
          }
          if (chunk.content) {
            fullContent += chunk.content;
            res.write(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`);
          }
          if (chunk.thinkingContent) {
            thinkingContent += chunk.thinkingContent;
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: chunk.thinkingContent })}\n\n`);
          }
        },
        userApiKey
      );

      try {
        // Save as a new assistant message linked to the same user message
        const newMsg = await prisma.message.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: fullContent,
            thinkingContent: thinkingContent || null,
            parentMessageId: messageId,
            sources: sourcesJson || null,
          },
        });

        // Send the new message ID so frontend can track versions
        res.write(`data: ${JSON.stringify({ type: 'regenerated', newMessageId: newMsg.id, parentMessageId: messageId })}\n\n`);
      } catch (dbErr: any) {
        console.warn('[Chat] Failed to save regenerated assistant response (conversation may have been deleted):', dbErr.message);
      }

      // Log usage
      const estimatedTokens = Math.ceil((targetMessage.content.length + fullContent.length) / 4);
      await prisma.usageLog.create({
        data: {
          userId: req.user!.userId,
          providerId,
          modelId,
          promptTokens: Math.ceil(targetMessage.content.length / 4),
          completionTokens: Math.ceil(fullContent.length / 4),
          totalTokens: estimatedTokens,
          webSearch: !!webSearch,
        },
      }).catch(e => console.error('[Chat] Usage log failed:', e));

      // Send done event now that DB write has finished
      res.write(`data: ${JSON.stringify({ type: 'done', conversationId })}\n\n`);

    } catch (error: any) {
      if (error.message === 'Client disconnected' || res.destroyed || res.writableEnded) {
        console.log('[Chat] Regenerate stream stopped by client. Saving partial response.');
        if (fullContent.trim()) {
          try {
            await prisma.message.create({
              data: {
                conversationId,
                role: 'ASSISTANT',
                content: fullContent + ' 🟥 *[Response stopped by user]*',
                thinkingContent: thinkingContent || null,
                parentMessageId: messageId,
                sources: sourcesJson || null,
              },
            });
          } catch (dbErr) {
            console.warn('[Chat] Failed to save partial regenerated message on disconnect:', dbErr);
          }
        }
        return;
      }
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('[Chat] Regenerate error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Regeneration failed' });
    }
  }
});

export default router;
