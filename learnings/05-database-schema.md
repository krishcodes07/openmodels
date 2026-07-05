# Database Schema

Located at: `server/prisma/schema.prisma`

## Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| email | String | Unique |
| name | String? | |
| avatar | String? | URL |
| password | String? | Null for OAuth-only users (hashed with bcrypt, 12 rounds) |
| authProvider | Enum (EMAIL, GOOGLE) | Default: EMAIL |
| googleId | String? | Unique |
| createdAt, updatedAt | DateTime | Auto |

**Relations**: has many `conversations`, many `apiKeys`, one `settings`

### `conversations`
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| title | String | Default: "New Chat" |
| userId | String | FK → users |
| providerId | String | e.g. "nvidia", "groq" |
| modelId | String | e.g. "meta/llama-3.3-70b-instruct" |
| createdAt, updatedAt | DateTime | Auto |

**Indexes**: `userId`
**Relations**: belongs to `user`, has many `messages`

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| conversationId | String | FK → conversations |
| role | Enum (USER, ASSISTANT, SYSTEM) | |
| content | String | Main message text |
| thinkingContent | String? | For thinking mode responses |
| imageUrls | String[] | For vision messages |
| tokenCount | Int? | |
| createdAt | DateTime | Auto |

**Indexes**: `conversationId`
**Cascade**: deletes with conversation

### `user_api_keys`
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → users |
| providerId | String | e.g. "nvidia" |
| encryptedKey | String | AES-256-GCM encrypted |
| iv | String | Initialization vector (hex) |
| authTag | String | GCM auth tag (hex) |
| createdAt, updatedAt | DateTime | Auto |

**Unique constraint**: `(userId, providerId)` — one key per provider per user
**Cascade**: deletes with user

### `user_settings`
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| userId | String | Unique, FK → users |
| defaultProviderId | String? | |
| defaultModelId | String? | |
| theme | String | Default: "dark" |
| systemPrompt | String? | |
| createdAt, updatedAt | DateTime | Auto |

## Prisma Commands
```bash
cd server
npx prisma generate    # Generate client
npx prisma db push     # Push schema to DB (dev)
npx prisma migrate dev # Create migration (prod)
npx prisma studio      # Visual DB editor
```

## Prisma Client
Singleton at `server/src/lib/prisma.ts` — prevents multiple instances during `tsx watch` hot reload.
