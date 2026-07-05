# Learning: Implementing Stop AI Response Feature with Background Streaming & Partial Saves

We successfully implemented the "Stop AI Response" feature (`specs/14-stop-feature.md`) across the frontend state, SSE API layer, and Express backend routing. Below is the detailed breakdown of the architecture, implementation choices, and key learnings.

---

## 1. Architecture Overview

```mermaid
sequenceDiagram
    autonearby Client
    participant ClientStore as Chat Store (Zustand)
    participant ClientAPI as API Client (Fetch)
    participant Server as Express Server
    participant DB as Prisma DB

    Client->>ClientStore: sendMessage / regenerateResponse
    ClientStore->>ClientStore: Create AbortController & add to activeStreams
    ClientStore->>ClientAPI: streamChat(..., signal)
    ClientAPI->>Server: POST /api/chat (SSE Stream)
    Server->>Server: Listen for client abort (res.destroyed)

    alt User clicks Stop
        Client->>ClientStore: stopResponse(conversationId)
        ClientStore->>ClientStore: Call controller.abort()
        ClientStore->>ClientStore: set(isStreaming: false)
        ClientAPI-->>Server: Terminate HTTP connection (AbortError)
        Server->>Server: Check callback/catch block -> Throw "Client disconnected"
        Server->>DB: Save partial response + "🟥 [Response stopped by user]"
        ClientStore->>ClientStore: Load updated conversation from DB (displays partial text)
    end
```

---

## 2. Technical Implementation Details

### Client-Side Connection Aborting
1. **Store Dictionary (`activeStreams`):** Track abort controllers on a per-conversation basis (`Record<string, AbortController>`) in `chatStore.ts` state. This satisfies the spec requirement for multi-chat background streams: switching conversations leaves background streams running in their own abort contexts.
2. **Rename Keys on Real ID Assignment:** When starting a chat on a new conversation, it initially uses a temporary ID (`pending-...`). When the server returns the actual conversation ID, the store dynamically updates the key mapping in `activeStreams` to match the new ID.
3. **Graceful Handling of `AbortError`:** Caught the Native Fetch `AbortError` inside store try-catch blocks to prevent default "API Execution Error" alerts. Instead, it triggers a quiet synchronization with the database to fetch whatever partial text was saved.

### Server-Side Partial Saving & Token Cleanup
1. **Loop Breaking Guard:** In the SSE callback loop (`onEvent`), checking `res.destroyed` before processing new chunks allows the backend to instantly escape `provider.streamChat` loops.
2. **Database Integrity Protection:** When the backend catches a disconnect error (triggered by client stop or page navigation):
   - It ignores writing the full message or calling `res.write` (which would throw closed-pipe errors).
   - It writes whatever partial text had already streamed to the database, appending a visual `🟥 *[Response stopped by user]*` notice.
   - This ensures the chat history remains clean and accurately reflects what the user saw on screen, preventing ghost API requests from consuming provider tokens.

---

## 3. Key Takeaways

1. **State Isolation:** Scoping the active streams dictionary to the Zustand store makes background execution extremely clean, keeping background streaming completely independent from UI viewport switching.
2. **SSE Resiliency:** Always check for `res.destroyed` inside the callback loop when working with Node.js Server-Sent Events. Without this check, the server will continue wasting upstream API tokens even after the client terminates the connection.
