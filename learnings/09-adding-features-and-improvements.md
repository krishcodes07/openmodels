# Learnings: Adding Features & Improvements

We successfully implemented the specification detailed in `specs/03-adding-features-and-impove.md`.

---

## 1. Core Changes & API Integration

### Provider Cleanup
- **Together AI Removal**: Together AI provider was cleanly removed from the backend (`registry.ts`, config files) and the provider implementation file was deleted.

### Web Search Backend Integration
- **Implementation Location**: `server/src/lib/search.ts`
- **Fallback Logic**:
  1. Scrapes **DuckDuckGo HTML Search** first using robust regex patterns.
  2. Falls back to **DuckDuckGo Instant Answers API** if scraping fails or is rate-limited.
  3. Falls back to **Wikipedia Search API** as a final safety net.
- **RAG Injection**: When `webSearch` is enabled, the backend intercepts the message, retrieves search results, and appends them to the final user payload sent to the LLM. The database keeps the user's raw message clean.

### File / Image Uploads
- **Multer Middleware**: Integrated `multer` to write uploaded files to `server/uploads/` with unique randomized suffixes.
- **Static Assets Serving**: Served `server/uploads/` statically at `http://localhost:3001/uploads/*`.
- **Frontend File Handler**: Allows user to select images, shows loading spinner, and renders small thumbnail previews in the input box before submission.
- **Vision Payload mapping**: Updated all registered providers (Nvidia, Groq, OpenRouter, Gemini) to map the dynamic `imageUrls` list into OpenAI-standard structure `{ type: "image_url", image_url: { url } }` for vision capabilities.

---

## 2. Frontend Redesign & UI Overhaul

### Overhauled Settings Page
- **Tabbed Layout**: Replaced the plain API key list with a vertical tabbed settings layout containing:
  - **General Settings**: For toggling the light/dark theme and editing the default system instruction prompt.
  - **Manage APIs**: Select provider from a clean card layout and configure keys. Included AES-256-GCM encryption security banner.
  - **Usage & Analytics**: Mock data dashboard showing Monthly active tokens, total chats, average response latency, and a graphical token breakdown.

### Two-Step Header Selector
- **Navigation Flow**: Redesigned the header to display `Provider > Model` (e.g. `Groq > Llama 3 8B`).
- **Interactive Dropdowns**:
  - Clicking **Provider Name** opens a list with search box. Changing provider automatically links and triggers the first model of that provider.
  - Clicking **Model Name** searches and displays all LLMs supported by that provider, along with vision and reasoning flags.

### Chat Avatars & Collapsible Thoughts
- **Visual Design**: Align user messages to the right inside clean rounded bubbles next to user's initials/OAuth avatar. Assistant replies are shown directly on the page on the left next to a Bot/Sparkles gradient icon.
- **Thinking Blocks**: Handled both SSE `thinkingContent` chunks and inline `<think>...</think>` tags using a custom parse helper. Displayed reasoning inside a premium expandable block containing up/down toggle arrows.
- **Copy Action**: Code blocks inside Markdown responses now render with language indicator and custom copy buttons.
