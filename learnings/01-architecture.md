# OpenModels Architecture

## Project Type
Multi-provider AI chat SaaS (like ChatGPT but for any AI provider).

## Monorepo Structure

```
openmodels/
├── client/          # Vite + React + TypeScript frontend
├── server/          # Express + TypeScript backend
├── specs/           # Feature specification docs
├── learnings/       # Context docs for AI assistants
├── .env             # Local environment variables
├── .env.example     # Template with all required env vars
└── package.json     # Root scripts (uses `concurrently` for dev)
```

## Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite 8
- **Styling**: TailwindCSS v4 (uses `@tailwindcss/vite` plugin, NOT PostCSS)
- **State**: Zustand (stores in `client/src/stores/`)
- **Routing**: React Router DOM v7
- **Icons**: Lucide React
- **Markdown**: react-markdown

### Backend
- **Runtime**: Node.js + TypeScript (via `tsx` for dev)
- **Framework**: Express 4
- **ORM**: Prisma (PostgreSQL)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **AI SDK**: OpenAI SDK (used as client for all OpenAI-compatible APIs)
- **Validation**: Zod (available, not heavily used yet)

## Running the App

```bash
# Root: starts both client (port 5173) and server (port 3001)
npm run dev

# Or individually:
cd client && npm run dev    # Vite on :5173
cd server && npm run dev    # tsx watch on :3001
```

The Vite dev server proxies `/api` requests to `localhost:3001` (configured in `vite.config.ts`).

## Key Design Decisions

1. **Feature-based folder structure** — NOT layer-based. Code lives in `features/auth/`, `features/chat/`, etc.
2. **Provider abstraction** — All AI providers implement `BaseProvider`. Adding a new one = create file + register in registry.
3. **SSE streaming** — Chat responses stream via Server-Sent Events (not WebSocket).
4. **JWT auth** — Access token (15min) + refresh token (7d). Tokens stored in localStorage.
5. **Encrypted API keys** — User API keys encrypted with AES-256-GCM before DB storage.
6. **No hardcoded models** — Frontend fetches models dynamically from backend per provider.
7. **Capability-driven UI** — Chat input toggles (vision, thinking, web search) appear only when the selected model supports them.
