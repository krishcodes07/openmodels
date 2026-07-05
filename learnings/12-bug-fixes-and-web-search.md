# Learnings: Bug Fixes & Web Search Overhaul

Implemented `specs/06-bug-fixes.md`.

---

## 1. Chat Title: First Prompt as Immediate Fallback

**Problem**: New conversations were titled "New Chat" until the AI generated a title. If title generation failed (API timeout, rate limit, etc.), the chat was stuck with a generic "New Chat" title forever.

**Fix (Backend — `server/src/features/chat/routes.ts`)**: Changed the initial `prisma.conversation.create()` to use `message.substring(0, 100)` as the title instead of `"New Chat"`. The AI-generated title update still runs fire-and-forget afterward and overwrites if successful.

**Fix (Frontend — `client/src/stores/chatStore.ts`)**: In `sendMessage`, when no `conversationId` exists (new chat), the store immediately creates a temporary `Conversation` object with `title: content.substring(0, 100)` and sets it as `currentConversation`. This shows up instantly in the sidebar.

## 2. Chat Sessions Blocking Each Other

**Problem**: `isStreaming` was a single global boolean. When the user started a new chat while a previous chat was still generating a response, the input textarea was `disabled={isStreaming}` and thus unresponsive.

**Fix**:
- `createNewChat()` now explicitly resets `isStreaming: false` for the new view.
- The `ChatInput.tsx` textarea no longer uses `disabled={isStreaming}` — changed to `disabled={false}`.
- Streaming state is conceptually per-view: when the user navigates away, the old stream continues silently in the background (writing to DB) but does not block the new view's UI.

## 3. Streaming Response Leaking into New Chat

**Problem**: When the user started chatting and then immediately clicked "+ New Chat", the SSE callback in `sendMessage` used `get()` to read `currentConversation`. Since `createNewChat()` sets `currentConversation: null`, the still-running stream callback saw a null conversation and injected the response into the new chat.

**Fix (Conversation Binding Pattern)**:
- At the start of `sendMessage`, snapshot `originConversationId` and `tempConversation?.id`.
- Inside the SSE callback, check `isStillViewing`: compare the current store's `currentConversation.id` against the captured origin.
- If the user has navigated to a different chat, the callback **silently skips** UI updates. The backend still saves everything to DB correctly because `boundConversationId` is captured at conversation creation time.
- On `done` event from a background stream, we still call `fetchConversations()` to refresh the sidebar.

**Backend Hardening**: The server-side handler captures `boundConversationId = conversation.id` immediately after creating/loading the conversation. All subsequent DB writes (save messages, update timestamp, title) use this bound ID, preventing any cross-conversation contamination.

## 4. Web Search: DuckDuckGo → Firecrawl

**Problem**: Web search was just scraping DuckDuckGo HTML, returning snippets without real page content. Not competitive with Gemini/ChatGPT/Perplexity-quality search.

**Fix — Complete rewrite of `server/src/lib/search.ts`**:

### Architecture (3-step pipeline):
1. **Query Generation**: The user's message + conversation history is sent to the *same AI model* to generate 2-3 optimized search queries (e.g. "latest tech news 2026", "sports headlines today")
2. **Firecrawl Search + Scrape**: Each query is sent to `POST https://api.firecrawl.dev/v2/search` with `scrapeOptions: { formats: ['markdown'] }`. This returns actual scraped page content in markdown.
3. **Context Assembly**: Results are deduplicated by URL, truncated to 2000 chars each, formatted with source citations, and injected into the chat as `[Web Search Results]` context before the user message.

### API Key Flow:
- User's stored Firecrawl key (from `user_api_keys` table with `providerId: 'firecrawl'`) takes priority
- Falls back to platform-level `FIRECRAWL_API_KEY` from `.env`
- Falls back to basic DuckDuckGo Instant Answers API if no key at all

### Firecrawl API Details:
- **Base URL**: `https://api.firecrawl.dev`
- **Auth**: `Authorization: Bearer fc-YOUR-API-KEY`
- **Search endpoint**: `POST /v2/search`
- **Request body**: `{ query, limit, scrapeOptions: { formats: ['markdown'] }, timeout: 30000 }`
- **Response**: `{ success, data: { web: [{ title, description, url, markdown }] } }`

## 5. Web Search Provider in Settings

**Added to `client/src/features/settings/SettingsPage.tsx`**:
- New "Web Search Provider" card in the Manage APIs tab
- Firecrawl API key input with show/hide toggle
- Save/delete buttons with loading/success states
- Link to firecrawl.dev for obtaining API keys
- Uses the existing `api.saveApiKey('firecrawl', key)` / `api.deleteApiKey('firecrawl')` — no new backend routes needed since the API key system is provider-agnostic

**Added to `server/src/config/index.ts`**:
- `firecrawl: { apiKey: process.env.FIRECRAWL_API_KEY }` section

**Added to `.env` / `.env.example`**:
- `FIRECRAWL_API_KEY` environment variable

## Key Patterns Established

### Conversation-scoped streaming
When starting a stream, capture the conversation context at the point of invocation. The SSE callback checks on every event whether the user is still viewing the originating conversation before applying UI updates. This prevents any cross-conversation state pollution.

### Web search as a RAG pipeline
The search module follows a generate-search-assemble pattern:
1. AI generates diverse search queries
2. External API fetches and scrapes pages
3. Results assembled as structured context for the final AI response

This is extensible: adding a new search provider (e.g., Tavily, Serper) means adding a new search function and a conditional branch in the main `searchWeb()` function.

## Files Modified

| File | Change |
|------|--------|
| `server/src/lib/search.ts` | Complete rewrite: Firecrawl + AI query generation |
| `server/src/features/chat/routes.ts` | First-prompt title, bound conversation ID, Firecrawl key lookup |
| `server/src/config/index.ts` | Added `firecrawl` config section |
| `client/src/stores/chatStore.ts` | Conversation-scoped streaming, title fallback, guard checks |
| `client/src/features/chat/ChatInput.tsx` | Removed `disabled={isStreaming}` from textarea |
| `client/src/features/settings/SettingsPage.tsx` | Web Search Provider section for Firecrawl API key |
| `.env` / `.env.example` | Added `FIRECRAWL_API_KEY` |
