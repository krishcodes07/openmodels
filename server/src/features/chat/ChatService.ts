import { prisma } from '../../lib/prisma';
import fs from 'fs';
import path from 'path';
import { providerRegistry } from '../../providers/registry';
import { decrypt } from '../../lib/encryption';
import { searchWeb } from '../../lib/search';
import { config } from '../../config';
import type { ChatMessage } from '../../providers/base.provider';

export class ChatService {
  /**
   * Generates a short AI-based title for a new conversation.
   */
  static async generateTitle(
    providerId: string,
    modelId: string,
    userMessage: string,
    apiKey?: string
  ): Promise<string> {
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
      console.error('[ChatService] Title generation failed:', err);
      return userMessage.substring(0, 60);
    }
  }

  /**
   * Decrypts and retrieves a user's API key for a given provider.
   */
  static async getUserApiKey(userId: string, providerId: string): Promise<string | undefined> {
    const storedKey = await prisma.userApiKey.findUnique({
      where: {
        userId_providerId: {
          userId,
          providerId,
        },
      },
    });
    if (storedKey) {
      return decrypt(storedKey.encryptedKey, storedKey.iv, storedKey.authTag);
    }
    return undefined;
  }

  /**
   * Parses source details from Firecrawl/Web search markdown outputs.
   */
  static parseSearchSources(searchContext: string): { title: string; url: string; description: string }[] {
    const sourceLines = searchContext.split('\n');
    const sources: { title: string; url: string; description: string }[] = [];
    let currentSource: any = {};

    for (const line of sourceLines) {
      if (line.startsWith('Title: ')) currentSource.title = line.substring(7);
      if (line.startsWith('URL: ')) currentSource.url = line.substring(5);
      if (line.startsWith('Content:')) {
        currentSource.description = '';
      } else if (
        currentSource.description !== undefined &&
        !line.startsWith('[Source') &&
        !line.startsWith('---') &&
        !line.startsWith('Title:') &&
        !line.startsWith('URL:') &&
        !line.startsWith('Search queries')
      ) {
        currentSource.description = (currentSource.description + ' ' + line).trim().substring(0, 200);
      }
      if (line.startsWith('---') || line.startsWith('[Source')) {
        if (currentSource.url) sources.push({ ...currentSource });
        currentSource = {};
      }
    }
    if (currentSource.url) sources.push(currentSource);
    return sources;
  }

  /**
   * Performs web search and formats context for LLMs.
   */
  static async executeWebSearch(
    userId: string | undefined,
    query: string,
    history: { role: string; content: string }[],
    providerId: string,
    modelId: string,
    apiKey?: string
  ): Promise<{ finalPrompt: string; sourcesJson: string | null }> {
    try {
      let firecrawlKey: string | undefined;
      if (userId) {
        firecrawlKey = await this.getUserApiKey(userId, 'firecrawl');
      }

      const searchContext = await searchWeb(
        query,
        history,
        providerId,
        modelId,
        apiKey,
        firecrawlKey
      );

      const sources = this.parseSearchSources(searchContext);
      return {
        finalPrompt: `[Web Search Results]\n${searchContext}\n\n[User Query]\n${query}`,
        sourcesJson: JSON.stringify(sources),
      };
    } catch (err) {
      console.error('[ChatService] Web search failed:', err);
      return { finalPrompt: query, sourcesJson: null };
    }
  }

  /**
   * Resolves the custom system instruction prompt for a user.
   */
  static async getSystemPrompt(userId: string): Promise<string | undefined> {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    return settings?.systemPrompt || undefined;
  }

  /**
   * Seeds default personas if none exist in the database.
   */
  static async seedDefaultPersonas(): Promise<void> {
    try {
      console.log('[ChatService] Seeding default personas...');
      const filePath = path.join(__dirname, '../personas/prebuilt_personas.json');
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const defaultPersonas = JSON.parse(fileContent);

        const jsonNames = defaultPersonas.map((p: any) => p.name);

        // Delete any pre-built personas no longer defined in the JSON file
        await prisma.persona.deleteMany({
          where: {
            userId: null,
            name: { notIn: jsonNames },
          },
        });

        for (const p of defaultPersonas) {
          const existingRecords = await prisma.persona.findMany({
            where: { name: p.name, userId: null },
            orderBy: { createdAt: 'asc' },
          });

          if (existingRecords.length > 0) {
            const primary = existingRecords[0];

            // Update primary persona details
            await prisma.persona.update({
              where: { id: primary.id },
              data: {
                description: p.description,
                systemPrompt: p.systemPrompt,
                imageUrl: p.imageUrl,
                category: p.category || null,
              },
            });

            // If there are duplicate records, clean them up and merge references
            if (existingRecords.length > 1) {
              const duplicates = existingRecords.slice(1);
              const duplicateIds = duplicates.map(d => d.id);

              console.log(`[ChatService] Found ${duplicates.length} duplicates for "${p.name}". Merging and deleting...`);

              // Point any conversations using duplicate persona IDs to the primary one
              await prisma.conversation.updateMany({
                where: { personaId: { in: duplicateIds } },
                data: { personaId: primary.id },
              });

              // Safely delete the duplicates
              await prisma.persona.deleteMany({
                where: { id: { in: duplicateIds } },
              });
            }
          } else {
            // Create the persona if it doesn't exist
            await prisma.persona.create({
              data: {
                name: p.name,
                description: p.description,
                systemPrompt: p.systemPrompt,
                imageUrl: p.imageUrl,
                category: p.category || null,
                userId: null,
              },
            });
          }
        }
        console.log('[ChatService] Default personas seeded/updated successfully.');
      } else {
        console.warn(`[ChatService] Pre-built personas JSON not found at: ${filePath}`);
      }
    } catch (err) {
      console.error('[ChatService] Error seeding personas:', err);
    }
  }
}
