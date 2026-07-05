# API Routes Reference

Base: `/api`

## Auth (`/api/auth`) — No auth required

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/register` | `{ email, password, name? }` | `{ user, accessToken, refreshToken }` |
| POST | `/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/google` | `{ credential }` (Google JWT) | `{ user, accessToken, refreshToken }` |
| POST | `/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| GET | `/me` | — | `{ user }` (requires Bearer token) |
| GET | `/config` | — | `{ googleClientId }` |

## Providers (`/api/providers`) — No auth required

| Method | Path | Response |
|--------|------|----------|
| GET | `/` | `{ providers: ProviderInfo[] }` |
| GET | `/:id/models` | `{ models: ProviderModel[] }` |

## Conversations (`/api/conversations`) — Auth required

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/` | — | `{ conversations[] }` (ordered by updatedAt desc, includes message count) |
| GET | `/:id` | — | `{ conversation }` (includes messages ordered by createdAt asc) |
| POST | `/` | `{ title?, providerId?, modelId? }` | `{ conversation }` |
| PATCH | `/:id` | `{ title?, providerId?, modelId? }` | `{ conversation }` |
| DELETE | `/:id` | — | `{ success: true }` |

## Chat (`/api/chat`) — Auth required

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/` | `{ conversationId?, message, providerId, modelId, thinking?, webSearch? }` | SSE stream |

**SSE Events:**
```
data: { "type": "content", "content": "token text" }
data: { "type": "thinking", "content": "thinking text" }
data: { "type": "done", "conversationId": "clx..." }
data: { "type": "error", "error": "error message" }
```

Response headers: `Content-Type: text/event-stream`, `X-Conversation-Id: <id>`

If `conversationId` is not provided, a new conversation is created automatically.

## Settings (`/api/settings`) — Auth required

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/` | — | `{ settings }` |
| PATCH | `/` | `{ defaultProviderId?, defaultModelId?, theme?, systemPrompt? }` | `{ settings }` |
| GET | `/api-keys` | — | `{ apiKeys: [{ id, providerId, configured, updatedAt }] }` |
| PUT | `/api-keys/:providerId` | `{ apiKey }` | `{ success, providerId }` |
| DELETE | `/api-keys/:providerId` | — | `{ success }` |
| GET | `/api-keys/:providerId/verify` | — | `{ configured: boolean }` |

## Auth Pattern
All protected routes use `authenticate` middleware (`server/src/middleware/auth.ts`).
- Reads `Authorization: Bearer <token>` header
- Verifies JWT and attaches `req.user = { userId, email }` to request
- Returns 401 on missing/invalid token

## Express Typing Note
`req.params.id` has type `string | string[]` in Express 5 types. Always cast: `const id = req.params.id as string;`
