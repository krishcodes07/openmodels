# Current Status & What's Next

Last updated: 2026-07-03

## What's Done (Step 1 + Step 2 + Step 3 + Chat Fixes)

### ✅ Backend
- [x] Express server with all middleware (CORS, JSON, cookies, error handler)
- [x] Prisma schema with all tables
- [x] JWT authentication (register, login, refresh, me)
- [x] Google OAuth route (decodes Google JWT, creates/links user)
- [x] Provider system (BaseProvider abstract class)
- [x] NVIDIA NIM provider with dynamic model listing (standard fallback)
- [x] Groq provider with dynamic model listing (standard fallback)
- [x] OpenRouter provider with dynamic model listing (standard fallback)
- [x] Google Gemini provider with dynamic model listing (standard fallback)
- [x] Together AI provider with dynamic model listing (standard fallback)
- [x] Provider registry (singleton, auto-discovery via API)
- [x] Chat endpoint with SSE streaming (returns `usingServerKey` flag)
- [x] Conversation CRUD
- [x] AI-generated conversation titles immediately after the first user message
- [x] Settings & API key management (encrypted with AES-256-GCM)
- [x] `.env.example` with all variables

### ✅ Frontend
- [x] Vite + React + TailwindCSS v4 setup
- [x] Overhauled UI/UX with minimalist, neutral dark/light theme options
- [x] Auth page (login/register/Google Sign-In integration via official SDK)
- [x] Chat layout (sidebar + header + messages + input)
- [x] Welcome screen with prompt suggestions (no bulky placeholders)
- [x] Compact Model selector in header showing "Top 5 + More" patterns and provider tabs
- [x] Dynamic model discovery using the user's specific decrypted API keys (or platform keys)
- [x] Streaming message display with typing cursor
- [x] Thinking mode display (separate box for thinking content)
- [x] Capability-based toggles (Attach/Think/Search show only when model supports them)
- [x] Auto-resizing textarea with Enter/Shift+Enter
- [x] Sidebar with conversation list, search, inline rename, delete
- [x] Circular user profile in sidebar footer
- [x] Settings page with API key management per provider
- [x] Theme Toggle (Light/Dark mode) on top right
- [x] Warning banner when using server-hosted API keys
- [x] Zustand stores (auth + chat)
- [x] API client with auto token refresh
- [x] Protected routing

### ✅ Both compile with zero TypeScript errors

## What's NOT Done Yet

### Not implemented (spec says "architecture ready" but not built):
- [ ] Google OAuth credential verification (currently decodes JWT without Google public key verification)
- [ ] Actual image upload for vision models (UI button exists, upload logic not wired)
- [ ] Web search backend integration (toggle exists, backend structure ready)
- [ ] Database migrations (using `db push` for dev, no migration history)

