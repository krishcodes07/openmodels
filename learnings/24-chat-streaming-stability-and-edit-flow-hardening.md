# Hardening Chat Streaming And Stability

In this session, we resolved a series of critical chat streaming race conditions, state synchronization conflicts, and database/client cleanup behaviors during error states.

## Key Hardening Accomplishments

### 1. Stop-Response Persistence
- **Behavior**: Stopped streams now cleanly save and persist whatever content was generated up to the user's interruption point, appending a neat custom suffix `🟥 *[Response stopped by user]*`.
- **Implementation**: Rewrote the `AbortError` stream-termination catch block to write the partial state directly to the database (for authenticated sessions) or update the local store (for anonymous sessions) instead of discarding the message.

### 2. Conversation State Synchronization (Header Extraction)
- **Behavior**: Fixed "Conversation not found" errors that occurred when trying to send subsequent messages in a new chat.
- **Implementation**: Modified `streamChat` in `api.ts` to extract the `X-Conversation-Id` header immediately when the HTTP request begins, rather than waiting for the title or done events. Emitted a synthetic `conversationId` event that the Zustand `messageSlice` handles by immediately rewriting temporary pending conversation IDs to permanent database IDs across the active stores.

### 3. Stream Race Condition Hardening (Superseded Streams)
- **Behavior**: Fixed the issue where editing a prompt while AI was streaming cancelled the previous stream but prevented the new edited stream's output from showing.
- **Implementation**:
  - Added checks at the start of all streaming catch blocks (`AbortError` or regular error) in `sendMessage`, `regenerateResponse`, and `editMessage` to verify if the active stream controller has already been replaced by a newer stream (`get().activeStreams[activeId] !== controller`). If it has been superseded, the catch block exits early, preventing older abort/error signals from resetting `isStreaming` or wiping the streaming contents of the new stream.
  - Reset conversation-specific streaming contents, thinking contents, and sources at the start of both `editMessage` and `regenerateResponse` (in both anonymous and authenticated paths) to prevent stale residues from polluting new stream sessions.

### 4. UI Stream Alignment for Edit Messages
- **Behavior**: Aligned the streaming bubble of edited prompts to render directly under the user message bubble being edited, rather than rendering at the bottom of the message container.
- **Implementation**: Set `regeneratingMessageId` to the active `messageId` at the start of `editMessage`, clearing it back to `null` when the stream finishes or fails.

### 5. Stale Error Cleanup and Orphaned Prompts
- **Behavior**: When a model error occurs:
  - The UI filters out the temporary error bubble and deletes the corresponding user message when the user switches model/provider.
  - If they refresh the browser, the error and user message are gone completely.
  - Resolves orphaned prompts (user prompts left with no assistant response due to failures) in both new and old chats.
- **Implementation**:
  - **Server-Side**: Added a cleanup block to the POST `/api/chat` route catch handler. If a stream fails with an error (and not a client disconnect), the user message is deleted from the database. If it's a new conversation, the conversation is also deleted.
  - **Client-Side**: Simplified the client filters in `selectModel`/`selectProvider` to prune any user message that is not immediately followed by an assistant message in the stream-sanitized history list.

## Engineering Takeaways
- **Async Signal Race Conditions**: Synchronously calling `.abort()` triggers the target `AbortError` block asynchronously (on the microtask queue). If you start a new stream synchronously in the same event loop tick, the old stream's catch block will execute after the new stream has initialized, overwriting its `isStreaming: true` state. Comparing the active controller reference inside the catch block is a robust design pattern to prevent older streams from modifying state.
- **Header-Level Synchronization**: Don't wait for SSE events to synchronize entity IDs. Extracting response headers as early as possible ensures that state maps are populated before the payload body begins processing.
