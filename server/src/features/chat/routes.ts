import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';
import { providerRegistry } from '../../providers/registry';
import { ChatMessage } from '../../providers/base.provider';
import { config } from '../../config';
import { ChatService } from './ChatService';
import multer from 'multer';
import path from 'path';

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

// POST /api/chat
router.post('/', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const { conversationId, message, providerId, modelId, thinking, webSearch, imageUrls, personaId } = req.body;

    if (!message || !providerId || !modelId) {
      res.status(400).json({ error: 'message, providerId, and modelId are required' });
      return;
    }

    const provider = providerRegistry.get(providerId);
    if (!provider) {
      res.status(400).json({ error: `Provider '${providerId}' not found` });
      return;
    }

    // Check email verification and message limits for authenticated users
    if (req.user) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { emailVerified: true }
      });

      if (user && !user.emailVerified) {
        const messageCount = await prisma.message.count({
          where: {
            conversation: {
              userId: req.user.userId,
            },
            role: 'USER',
          },
        });

        if (messageCount >= 5) {
          res.status(403).json({
            error: 'Email verification required. You have used your 5 free messages. Please verify your email to continue.',
            code: 'EMAIL_UNVERIFIED'
          });
          return;
        }
      }
    }

    // Get user's API key for this provider if authenticated
    let userApiKey: string | undefined;
    if (req.user) {
      userApiKey = await ChatService.getUserApiKey(req.user.userId, providerId);
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
            personaId: personaId || null,
          },
          include: { messages: true },
        });
      }
      boundConversationId = conversation.id;
    }

    // Set up SSE headers early
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Conversation-Id', boundConversationId);

    // We will generate the AI title for new conversations after the response has fully streamed.

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
    let sourcesJson: string | null = null;
    if (webSearch) {
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

      const searchResult = await ChatService.executeWebSearch(
        req.user?.userId,
        message,
        historyForSearch,
        providerId,
        modelId,
        userApiKey
      );
      finalUserMessage = searchResult.finalPrompt;
      sourcesJson = searchResult.sourcesJson;
    }

    // Resolve system prompt instructions (prioritize active persona systemPrompt)
    let systemPrompt: string | undefined;
    const activePersonaId = personaId || conversation?.personaId;
    if (activePersonaId) {
      const persona = await prisma.persona.findUnique({
        where: { id: activePersonaId },
      });
      if (persona) {
        systemPrompt = persona.systemPrompt;
      }
    }
    if (!systemPrompt && req.user) {
      systemPrompt = await ChatService.getSystemPrompt(req.user.userId);
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

    // Send usingServerKey flag right away
    if (usingServerKey) {
      res.write(`data: ${JSON.stringify({ type: 'info', usingServerKey: true })}\n\n`);
    }

    // Send sources if web search produced them
    if (sourcesJson) {
      res.write(`data: ${JSON.stringify({ type: 'sources', sources: JSON.parse(sourcesJson) })}\n\n`);
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

      // Save assistant message (only if authenticated)
      if (req.user) {
        try {
          await prisma.message.create({
            data: {
              conversationId: boundConversationId,
              role: 'ASSISTANT',
              content: fullContent,
              thinkingContent: thinkingContent || null,
              sources: sourcesJson || null,
              parentMessageId: userMsgId,
              userContent: message,
            },
          });

          // Update conversation timestamp
          await prisma.conversation.update({
            where: { id: boundConversationId },
            data: { updatedAt: new Date() },
          });
        } catch (dbErr: any) {
          console.warn('[Chat] Failed to save assistant message:', dbErr.message);
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

      }

      // Generate AI title for new conversations (after the response is fully generated)
      const isNew = req.user ? isNewConversation : (!req.body.messages || req.body.messages.length <= 1);
      if (isNew) {
        try {
          const title = await ChatService.generateTitle(providerId, modelId, message, userApiKey);
          if (req.user) {
            await prisma.conversation.update({
              where: { id: boundConversationId },
              data: { title },
            });
          }
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'title', title, conversationId: boundConversationId })}\n\n`);
          }
        } catch (e) {
          console.error('[Chat] Failed to generate/update title:', e);
        }
      }

      // Send done event
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
                sources: sourcesJson || null,
                parentMessageId: userMsgId,
                userContent: message,
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
      
      // Clean up DB: Delete the user message and conversation (if new) on error
      if (req.user && userMsgId) {
        try {
          await prisma.message.delete({
            where: { id: userMsgId },
          });
          if (isNewConversation) {
            await prisma.conversation.delete({
              where: { id: boundConversationId },
            });
          }
        } catch (dbErr) {
          console.warn('[Chat] Failed to clean up user message/conversation on error:', dbErr);
        }
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

// POST /api/chat/regenerate
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

    // Check email verification and message limits for authenticated users
    if (req.user) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { emailVerified: true }
      });

      if (user && !user.emailVerified) {
        const messageCount = await prisma.message.count({
          where: {
            conversation: {
              userId: req.user.userId,
            },
            role: 'USER',
          },
        });

        if (messageCount >= 5) {
          res.status(403).json({
            error: 'Email verification required. You have used your 5 free messages. Please verify your email to continue.',
            code: 'EMAIL_UNVERIFIED'
          });
          return;
        }
      }
    }

    // Get user API key
    const userApiKey = await ChatService.getUserApiKey(req.user!.userId, providerId);

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

    // Find target user message
    const targetMsgIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (targetMsgIndex === -1) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const historyMessages = conversation.messages.slice(0, targetMsgIndex);
    const targetMessage = conversation.messages[targetMsgIndex];

    // Handle web search
    let finalUserMessage = targetMessage.content;
    let sourcesJson: string | null = null;
    if (webSearch) {
      const historyForSearch = historyMessages.map(m => ({
        role: m.role.toLowerCase(),
        content: m.content,
      }));

      const searchResult = await ChatService.executeWebSearch(
        req.user!.userId,
        targetMessage.content,
        historyForSearch,
        providerId,
        modelId,
        userApiKey
      );
      finalUserMessage = searchResult.finalPrompt;
      sourcesJson = searchResult.sourcesJson;
    }

    // Resolve system prompt instructions (prioritize active persona systemPrompt)
    let systemPrompt: string | undefined;
    if (conversation.personaId) {
      const persona = await prisma.persona.findUnique({
        where: { id: conversation.personaId },
      });
      systemPrompt = persona?.systemPrompt;
    }
    if (!systemPrompt) {
      systemPrompt = await ChatService.getSystemPrompt(req.user!.userId);
    }

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
        const newMsg = await prisma.message.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: fullContent,
            thinkingContent: thinkingContent || null,
            parentMessageId: messageId,
            sources: sourcesJson || null,
            userContent: targetMessage.content,
          },
        });

        res.write(`data: ${JSON.stringify({ type: 'regenerated', newMessageId: newMsg.id, parentMessageId: messageId })}\n\n`);
      } catch (dbErr: any) {
        console.warn('[Chat] Failed to save regenerated response:', dbErr.message);
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
                userContent: targetMessage.content,
              },
            });
          } catch (dbErr) {
            console.warn('[Chat] Failed to save partial regenerated message:', dbErr);
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

// POST /api/chat/edit
router.post('/edit', authenticate, async (req: Request, res: Response) => {
  try {
    const { conversationId, messageId, content, providerId, modelId, thinking, webSearch } = req.body;

    if (!conversationId || !messageId || !content || !providerId || !modelId) {
      res.status(400).json({ error: 'conversationId, messageId, content, providerId, and modelId are required' });
      return;
    }

    const provider = providerRegistry.get(providerId);
    if (!provider) {
      res.status(400).json({ error: `Provider '${providerId}' not found` });
      return;
    }

    const targetMessage = await prisma.message.findFirst({
      where: { id: messageId, conversationId, role: 'USER' },
    });

    if (!targetMessage) {
      res.status(404).json({ error: 'User message not found' });
      return;
    }

    // Delete messages created after target user message, except assistant responses to this user message
    await prisma.message.deleteMany({
      where: {
        conversationId,
        createdAt: { gt: targetMessage.createdAt },
        NOT: {
          role: 'ASSISTANT',
          parentMessageId: messageId,
        },
      },
    });

    // Update target user message's content
    const updatedTargetMessage = await prisma.message.update({
      where: { id: messageId },
      data: { content },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Check email verification and message limits for authenticated users
    if (req.user) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { emailVerified: true }
      });

      if (user && !user.emailVerified) {
        const messageCount = await prisma.message.count({
          where: {
            conversation: {
              userId: req.user.userId,
            },
            role: 'USER',
          },
        });

        if (messageCount >= 5) {
          res.status(403).json({
            error: 'Email verification required. You have used your 5 free messages. Please verify your email to continue.',
            code: 'EMAIL_UNVERIFIED'
          });
          return;
        }
      }
    }

    // Get user API key
    const userApiKey = await ChatService.getUserApiKey(req.user!.userId, providerId);

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

    const targetMsgIndex = conversation.messages.findIndex(m => m.id === messageId);
    const historyMessages = conversation.messages.slice(0, targetMsgIndex);

    // Handle web search
    let finalUserMessage = content;
    let sourcesJson: string | null = null;
    if (webSearch) {
      const historyForSearch = historyMessages.map(m => ({
        role: m.role.toLowerCase(),
        content: m.content,
      }));

      const searchResult = await ChatService.executeWebSearch(
        req.user!.userId,
        content,
        historyForSearch,
        providerId,
        modelId,
        userApiKey
      );
      finalUserMessage = searchResult.finalPrompt;
      sourcesJson = searchResult.sourcesJson;
    }

    // Resolve system prompt instructions (prioritize active persona systemPrompt)
    let systemPrompt: string | undefined;
    if (conversation.personaId) {
      const persona = await prisma.persona.findUnique({
        where: { id: conversation.personaId },
      });
      systemPrompt = persona?.systemPrompt;
    }
    if (!systemPrompt) {
      systemPrompt = await ChatService.getSystemPrompt(req.user!.userId);
    }

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
      { role: 'user' as const, content: finalUserMessage, imageUrls: updatedTargetMessage.imageUrls || [] }
    );

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

      const newMsg = await prisma.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: fullContent,
          thinkingContent: thinkingContent || null,
          parentMessageId: messageId,
          sources: sourcesJson || null,
          userContent: content,
        },
      });

      res.write(`data: ${JSON.stringify({ type: 'regenerated', newMessageId: newMsg.id, parentMessageId: messageId })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', conversationId })}\n\n`);
    } catch (error: any) {
      if (error.message === 'Client disconnected' || res.destroyed || res.writableEnded) {
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
                userContent: content,
              },
            });
          } catch (dbErr) {
            console.warn('[Chat] Failed to save partial edited response:', dbErr);
          }
        }
        return;
      }
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('[Chat] Edit error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Edit failed' });
    }
  }
});

export default router;
