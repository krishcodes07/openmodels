# Codebase Refactoring & Future-proofing Learnings

## 1. Zustand Store Slicing
- **Context**: The `chatStore.ts` had grown to over 1,600 lines, managing all aspects of streaming, sandbox state, selection, anonymous limits, and theme setups.
- **Action**: Refactored the monolithic store into modular, logical slices using Zustand's slice creator pattern:
  - `types.ts`: Centralizes state/action interfaces, avoiding duplicate interface definitions.
  - `sandboxSlice.ts`: Sandbox display/updates.
  - `themeSlice.ts`: Layout theme toggles, sidebar state, user flag preferences.
  - `anonymousSlice.ts`: Local storage count and limits.
  - `modelSlice.ts`: Provider and model list state fetches.
  - `messageSlice.ts`: Streaming SSE, edits, message histories, and database saves.
- **Outcome**: Merged all slices into the main `useChatStore` wrapper inside `chatStore.ts`. Imports across the rest of the application remain intact and unchanged.

## 2. verbatimModuleSyntax Compliance
- **Requirement**: The TypeScript compiler configured on the client enforces strict module syntaxes: `verbatimModuleSyntax: true`.
- **Lesson**: When importing TypeScript interfaces or creators to split files, you must use `import type { StateCreator } from 'zustand'` or `import type { ChatState } from './types'` rather than value-level imports. Standard imports throw `TS1484` compilation errors when verbatim syntax rules are active.

## 3. Service Layer Extraction
- **Context**: Express routes in `server/src/features/chat/routes.ts` mixed routing structure, database creation logic, web search execution, encryption/decryption, and stream loops.
- **Action**: Extracted reusable business rules into `server/src/features/chat/ChatService.ts`:
  - `generateTitle(...)`: Parallel AI title creation helper.
  - `getUserApiKey(...)`: Secure API key retrieval.
  - `executeWebSearch(...)`: Handles background queries and parsed markdown link source formatting.
  - `getSystemPrompt(...)`: Fetches custom system instructions.
- **Outcome**: The Express route endpoints now delegate requests to `ChatService`, leaving the routes thin, extremely readable, and robust against future API schema changes.

## 4. LocalStorage Scale & Pruning
- **Enhancement**: Implemented a simple garbage collector `pruneAnonymousHistory(...)` inside the anonymous store slice. If the count of anonymous conversations exceeds `20`, the oldest conversations and their message dictionaries are dropped before syncing to `localStorage`. This prevents database quota limits and browser main-thread rendering lockups.
