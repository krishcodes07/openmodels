import { config } from '../config';
import { providerRegistry } from '../providers/registry';

// ============================================
// Web Search Module — Firecrawl-powered
// ============================================
// 1. Asks the AI model to generate 2-3 optimized search queries
// 2. Searches each query via Firecrawl
// 3. Returns scraped markdown content as context

interface FirecrawlWebResult {
  title?: string;
  description?: string;
  url?: string;
  markdown?: string;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data?: {
    web?: FirecrawlWebResult[];
  };
  warning?: string;
}

/**
 * Uses Firecrawl's /v2/search endpoint to search and scrape content.
 */
async function firecrawlSearch(query: string, apiKey: string, limit: number = 3): Promise<FirecrawlWebResult[]> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: {
          formats: ['markdown'],
        },
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Search] Firecrawl API error (${response.status}):`, errText);
      return [];
    }

    const result: FirecrawlSearchResponse = await response.json();
    if (!result.success || !result.data?.web) {
      console.warn('[Search] Firecrawl returned no web results for query:', query);
      return [];
    }

    return result.data.web;
  } catch (error) {
    console.error('[Search] Firecrawl request failed:', error);
    return [];
  }
}

/**
 * Uses the AI model to generate optimized search queries from the user's message.
 * Returns 2-3 queries that would yield better search results.
 */
async function generateSearchQueries(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  providerId: string,
  modelId: string,
  apiKey?: string
): Promise<string[]> {
  try {
    const provider = providerRegistry.get(providerId);
    if (!provider) {
      console.warn('[Search] Provider not found for query generation, using raw query');
      return [userMessage];
    }

    const platformKey = (config.providers as any)[providerId]?.apiKey || '';
    const key = apiKey || platformKey;
    if (!key) {
      console.warn('[Search] No API key for query generation, using raw query');
      return [userMessage];
    }

    // Build a compact context from conversation history (last 6 messages max)
    const recentHistory = conversationHistory.slice(-6).map(m => 
      `${m.role.toUpperCase()}: ${m.content.substring(0, 200)}`
    ).join('\n');

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const response = await provider.chat({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: `You are a search query optimizer. Given the user's question and conversation context, generate 2-3 concise and specific search queries that would find the most relevant and up-to-date information on the web.
Today's date is: ${today}.

RULES:
- Return ONLY the queries, one per line
- No numbering, no bullet points, no explanations
- Each query should be 3-8 words
- Make queries specific and diverse (cover different angles)
- If the user asks about recent/latest/current events, include time-relevant terms`,
        },
        {
          role: 'user',
          content: recentHistory
            ? `Conversation context:\n${recentHistory}\n\nUser's latest question: ${userMessage}`
            : userMessage,
        },
      ],
      maxTokens: 100,
      temperature: 0.3,
    }, key);

    const queries = response.content
      .trim()
      .split('\n')
      .map(q => q.replace(/^[\d\-\.\*\)]+\s*/, '').trim()) // strip numbering
      .filter(q => q.length > 2 && q.length < 200);

    if (queries.length === 0) {
      return [userMessage];
    }

    console.log('[Search] Generated queries:', queries);
    return queries.slice(0, 3);
  } catch (error) {
    console.error('[Search] Query generation failed, using raw query:', error);
    return [userMessage];
  }
}

/**
 * Retrieves the Firecrawl API key — first from user's stored keys, then from platform config.
 */
export function getFirecrawlApiKey(userFirecrawlKey?: string): string {
  return userFirecrawlKey || (config as any).firecrawl?.apiKey || '';
}

/**
 * Main web search function: generates queries → searches via Firecrawl → returns formatted context.
 */
export async function searchWeb(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  providerId: string,
  modelId: string,
  providerApiKey?: string,
  firecrawlApiKey?: string
): Promise<string> {
  const fcKey = getFirecrawlApiKey(firecrawlApiKey);
  
  if (!fcKey) {
    console.warn('[Search] No Firecrawl API key configured, falling back to basic search');
    return fallbackSearch(userMessage);
  }

  // Step 1: Generate optimized search queries using the AI model
  const queries = await generateSearchQueries(
    userMessage,
    conversationHistory,
    providerId,
    modelId,
    providerApiKey
  );

  // Step 2: Search each query via Firecrawl (parallel)
  const allResults: { query: string; results: FirecrawlWebResult[] }[] = [];
  
  const searchPromises = queries.map(async (query) => {
    const results = await firecrawlSearch(query, fcKey, 3);
    return { query, results };
  });

  const searchResults = await Promise.all(searchPromises);
  allResults.push(...searchResults);

  // Step 3: Deduplicate results by URL
  const seenUrls = new Set<string>();
  const uniqueResults: (FirecrawlWebResult & { fromQuery: string })[] = [];

  for (const { query, results } of allResults) {
    for (const result of results) {
      if (result.url && !seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        uniqueResults.push({ ...result, fromQuery: query });
      }
    }
  }

  if (uniqueResults.length === 0) {
    console.warn('[Search] No results from Firecrawl, falling back');
    return fallbackSearch(userMessage);
  }

  // Step 4: Format results with scraped content
  const formattedResults = uniqueResults.slice(0, 8).map((r, i) => {
    // Truncate markdown to keep context manageable
    const content = r.markdown 
      ? r.markdown.substring(0, 2000)
      : r.description || 'No content available.';

    return `[Source ${i + 1}]
Title: ${r.title || 'Untitled'}
URL: ${r.url || 'N/A'}
Content:
${content}`;
  });

  return `The following web search results were found for the user's query. Use this information to provide an accurate, up-to-date response. Cite sources using [Source N] format when referencing specific information.

Search queries used: ${queries.map(q => `"${q}"`).join(', ')}

${formattedResults.join('\n\n---\n\n')}`;
}

/**
 * Fallback search using DuckDuckGo when no Firecrawl key is available.
 */
async function fallbackSearch(query: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`
    );
    if (response.ok) {
      const data = await response.json();
      const results: string[] = [];
      
      if (data.AbstractText) {
        results.push(`Title: ${data.Heading || query}\nURL: ${data.AbstractURL || ''}\nContent: ${data.AbstractText}`);
      }
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
          if (topic.Text && topic.FirstURL) {
            results.push(`Title: ${topic.Text.substring(0, 80)}\nURL: ${topic.FirstURL}\nContent: ${topic.Text}`);
          }
        });
      }
      if (results.length > 0) {
        return results.join('\n\n');
      }
    }
  } catch (error) {
    console.error('[Search] Fallback search failed:', error);
  }
  return 'No search results found.';
}
