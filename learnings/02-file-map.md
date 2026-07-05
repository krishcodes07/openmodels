# OpenModels File Map

## Server (`server/src/`)

### Entry Point
- `index.ts` — Express app setup, middleware, route registration, starts on PORT (default 3001)

### Config
- `config/index.ts` — Reads `.env`, exports typed `config` object with jwt, google, encryption, providers

### Lib (Shared Utilities)
- `lib/prisma.ts` — Singleton Prisma client (prevents multiple instances during hot reload)
- `lib/jwt.ts` — `generateAccessToken()`, `generateRefreshToken()`, `verifyAccessToken()`, `verifyRefreshToken()`
- `lib/encryption.ts` — `encrypt(text)` → `{encrypted, iv, authTag}`, `decrypt(encrypted, iv, authTag)` → plaintext. Uses AES-256-GCM.

### Middleware
- `middleware/auth.ts` — `authenticate` middleware: validates Bearer token, attaches `req.user` (TokenPayload with userId, email)
- `middleware/error.ts` — Global error handler

### Providers (`providers/`)
- `base.provider.ts` — Abstract `BaseProvider` class + interfaces (`ProviderModel`, `ChatRequest`, `ChatResponse`, `StreamChunk`, etc.)
- `nvidia.provider.ts` — NVIDIA NIM implementation, uses OpenAI SDK pointed at `integrate.api.nvidia.com/v1`
- `groq.provider.ts` — Groq implementation, uses OpenAI SDK pointed at `api.groq.com/openai/v1`
- `registry.ts` — `ProviderRegistry` singleton. All providers registered here. `providerRegistry.get(id)`, `.getAll()`, `.getAllInfo()`

### Features (`features/`)
Each feature has a `routes.ts` file that exports an Express Router.

- `auth/routes.ts` — POST `/register`, `/login`, `/google`, `/refresh`; GET `/me`
- `chat/routes.ts` — POST `/` (requires auth). Handles SSE streaming. Creates conversation if none exists. Saves messages to DB.
- `conversations/routes.ts` — All require auth. GET `/`, GET `/:id`, POST `/`, PATCH `/:id`, DELETE `/:id`
- `providers/routes.ts` — Public. GET `/` (list providers), GET `/:id/models` (list models for provider)
- `settings/routes.ts` — All require auth. GET/PATCH `/` (user settings), GET/PUT/DELETE `/api-keys/:providerId`

### Database (`prisma/`)
- `schema.prisma` — Tables: `users`, `conversations`, `messages`, `user_api_keys`, `user_settings`. Enums: `AuthProvider`, `MessageRole`.

---

## Client (`client/src/`)

### Entry
- `main.tsx` — ReactDOM render
- `App.tsx` — Router setup with `ProtectedRoute` wrapper. Routes: `/auth`, `/`, `/chat/:conversationId`, `/settings`
- `index.css` — TailwindCSS v4 design system (`@theme` + `@layer base`)

### Types
- `types/index.ts` — `User`, `AuthResponse`, `Provider`, `Model`, `ModelCapabilities`, `Message`, `Conversation`, `UserSettings`, `ApiKeyInfo`, `StreamEvent`

### Services
- `services/api.ts` — `ApiClient` singleton. Handles all HTTP, auto token refresh on 401, SSE streaming for chat. All methods: `login`, `register`, `googleLogin`, `getMe`, `getProviders`, `getModels`, `getConversations`, `streamChat`, `saveApiKey`, etc.

### Stores (Zustand)
- `stores/authStore.ts` — `user`, `isAuthenticated`, `isLoading`. Actions: `login`, `register`, `googleLogin`, `logout`, `checkAuth`
- `stores/chatStore.ts` — `conversations`, `currentConversation`, `messages`, `providers`, `models`, `selectedProviderId`, `selectedModelId`, `isStreaming`, `streamingContent`, `thinkingContent`, toggles. Actions: `fetchProviders`, `fetchModels`, `selectProvider`, `sendMessage`, `loadConversation`, `createNewChat`, `deleteConversation`, `renameConversation`, etc.

### Features
- `features/auth/AuthPage.tsx` — Sign In / Create Account tabs, email/password inputs, Google OAuth button
- `features/chat/ChatLayout.tsx` — Main layout: Sidebar + Header + Messages/Welcome + Input
- `features/chat/ChatHeader.tsx` — Provider dropdown + Model dropdown (shows capabilities badges)
- `features/chat/ChatMessages.tsx` — Message list with markdown rendering, streaming cursor, thinking mode display
- `features/chat/ChatInput.tsx` — Auto-resize textarea, capability-based toggles (Attach/Think/Search), Enter=send, Shift+Enter=newline
- `features/chat/WelcomeScreen.tsx` — Logo, feature cards, clickable prompt suggestions
- `features/sidebar/Sidebar.tsx` — New Chat, search, conversation list (inline rename/delete on hover), user profile, settings/logout
- `features/settings/SettingsPage.tsx` — API key management per provider with save/delete, encryption notice
