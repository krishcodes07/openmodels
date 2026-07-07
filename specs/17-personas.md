# Feature Specification: Custom Personas & System Prompt Gallery

## 1. Overview
The **Custom Personas & System Prompt Gallery** allows users to browse pre-built system prompts/personas (like "Python Expert", "Socratic Teacher", "Copywriter") and create their own custom agents. 

When a user initiates a conversation using a persona:
- The persona's custom instructions are injected as the primary `system` instructions.
- The conversation is linked to the persona.
- The sidebar renders the persona's avatar next to the conversation title.
- The user can still swap underlying providers/models seamlessly.

---

## 2. Database Schema Changes (`server/prisma/schema.prisma`)

Add the `Persona` model and relate it to `User` and `Conversation`:

```prisma
// ============================================
// Personas
// ============================================

model Persona {
  id           String   @id @default(cuid())
  name         String
  description  String
  systemPrompt String
  imageUrl     String?  // Can be a URL, base64 data-URL, or preset icon identifier
  userId       String?  // Nullable: Null = pre-built system-wide persona. Otherwise = user-created.

  // Relations
  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversations Conversation[]

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
  @@map("personas")
}
```

### Update Existing Models:

1. **`User` Model**:
   ```prisma
   personas      Persona[]
   ```

2. **`Conversation` Model**:
   ```prisma
   personaId   String?
   persona     Persona?  @relation(fields: [personaId], references: [id], onDelete: SetNull)

   // Add index:
   @@index([personaId])
   ```

---

## 3. Backend Endpoints & Service Logic

### A. Database Seeding & Default Personas
We should dynamically seed default personas on server startup if they do not exist. Create the following standard personas:
1. **Python Expert**: "You are an expert Python software engineer. Write clean, PEP8-compliant, and well-documented Python code. Include unit tests and brief optimization notes." (Avatar: Python logo or custom developer icon).
2. **Socratic Teacher**: "You are a Socratic tutor. Do not give the user direct answers. Instead, ask helpful, progressive questions that guide them to discover the solution themselves." (Avatar: Ancient philosopher icon).
3. **Copywriter**: "You are an elite advertising copywriter. Write highly engaging, conversion-optimized copy, creative headlines, and content tailored to target audiences." (Avatar: Writing quill/pen icon).

### B. New Endpoints (`server/src/features/personas/routes.ts`)
Mount routes at `/api/personas`:
- `GET /`: Fetch all personas.
  - Return all system-wide personas (`userId: null`) + the user's custom personas (`userId: req.user.userId`).
  - Supports optional/anonymous authentication (anonymous users only get pre-built system-wide personas).
- `POST /` (Authenticated): Create a new persona.
  - Body: `{ name, description, systemPrompt, imageUrl }`.
  - Saves to database with `userId: req.user.userId`.
- `DELETE /:id` (Authenticated): Delete a persona.
  - Ensures the user owns the persona before deleting.

### C. Chat Streaming Service Update (`server/src/features/chat/ChatService.ts`)
Modify the message formatting:
- If a chat starts or is running with a `personaId`, fetch the persona.
- Use `persona.systemPrompt` as the base `system` instructions.
- If the user *also* has a global custom system prompt in their user settings, prepend/append them, or prioritize the persona's instructions (recommended: use the persona prompt as the primary system message, bypassing the global custom system instructions).

---

## 4. Frontend State Management (Zustand Slices)

### A. Extended Types (`client/src/stores/chat/types.ts`)
- Add properties:
  - `personas: Persona[]`
  - `activePersona: Persona | null`
- Add actions:
  - `fetchPersonas: () => Promise<void>`
  - `createPersona: (data: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>`
  - `deletePersona: (id: string) => Promise<void>`
  - `createNewChat: (personaId?: string) => void`

### B. New Slice File (`client/src/stores/chat/personaSlice.ts`)
- Implements the API calls for fetching, creating, and deleting personas.
- If the user is anonymous, store custom personas in LocalStorage (like conversations) to ensure identical functionality for guests.
- Combine the slice creator in `client/src/stores/chatStore.ts`.

---

## 5. UI & Component Upgrades

### A. Sidebar Link & Entry Point
- Add a "Personas" button under the Sidebar toggle and "+ New Chat" button.
- Design: A premium glassmorphic button with a Sparkles icon, displaying "Explore Personas".
- Clicking it routes the client to the `/personas` layout view.

### B. The Personas Page Layout (`/personas`)
- **Header**: Beautiful background gradient, title "Persona Directory", and description.
- **Tabs**: "Pre-Built Gallery" and "My Personas".
- **Gallery Grid**:
  - Cards featuring:
    - High-quality round avatars (presets, emoji, or uploaded file).
    - Bold persona names.
    - Subtle description text.
    - A "Use Persona" button. Clicking this triggers `createNewChat(persona.id)` and redirects the client to `/` with the new chat active.
- **Create Persona Form (Modal or Sub-view)**:
  - Input fields: Name, Description, System Instructions (textarea).
  - Avatar Selector: Provide a preset grid of colorful gradients & symbols/emojis, an Image URL text input, and a File Uploader.
  - Actions: "Cancel" and "Save & Launch Chat".

### C. Chat & Sidebar Visual Cues
- **Sidebar Chat List**:
  - In `Sidebar.tsx`, check if `conversation.personaId` is present.
  - If yes, query/find the persona and render its avatar image/preset in place of the default chat bubble.
- **Chat Header**:
  - Render a premium badge next to the model selection menu: `[ Avatar ] Python Expert (Persona)`.
  - Hovering over the badge shows a tooltip with the persona's system prompt description.
