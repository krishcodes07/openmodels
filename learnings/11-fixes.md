# Learnings: OpenModels Bug Fixes

A summary of the technical insights, design patterns, and debugging takeaways from addressing the issues in `specs/11-fixes.md`.

---

## 1. Prevent SSE Headers-Sent Mismatch with Asynchronous Tasks

### Context
In SSE (Server-Sent Events) streaming routes, we often kick off tasks in parallel (such as generating chat titles or running web search queries) before initiating the main response stream.

### Key Takeaway
- **Early Header Setting**: Always set the streaming headers (`Content-Type: text/event-stream`, `Cache-Control`, `Connection`) at the **beginning** of the express/router controller, immediately after basic request validation.
- **Why**: Calling `res.write()` inside any parallel task (e.g., streaming back a generated conversation title once it's ready) automatically commits the response and sends default headers. If the main route thread subsequently tries to call `res.setHeader()` after a slow asynchronous task (like a web search request) completes, Node.js throws `ERR_HTTP_HEADERS_SENT` and crashes the connection.
- **Rule**: Set headers early, then use `res.write` freely.

---

## 2. Eliminate Database Sync Race Conditions in Streams

### Context
When the server finishes streaming, it sends a `'done'` SSE event. The client responds to this by making an API call to load the complete message history from the database to ensure sync.

### Key Takeaway
- **Sequencing**: The `'done'` event must only be sent **after** all Prisma database insertions and updates (messages, usage logs, conversation timestamps, etc.) have successfully resolved.
- **Why**: If `'done'` is emitted before `prisma.message.create` completes, the client's subsequent fetch request will hit the database before the new assistant message is written, causing the streaming response to temporarily vanish from the chat history until a manual page refresh.

---

## 3. Handle Multi-Source Citations Reactively in Markdown

### Context
Models sometimes cite multiple search references in a single bracket pair, such as `[Source 2, Source 5]` or `[Source 2, 5]`.

### Key Takeaway
- **Preprocess Before Markdown Rendering**: Standardize the text block prior to passing it to `ReactMarkdown`. Use a regex to extract any list inside brackets and split the contents by comma.
- **Map to Individual Anchors**: Map each item in the split array to a standard individual markdown link (e.g., `[Source X](https://source.citation/X)`). This allows the JSX markdown component customizer to resolve each index separately and render them side-by-side as clean, clickable domain favicon badges.

---

## 4. Leverage In-Memory Multer Storage for Base64 Assets

### Context
Storing user-uploaded image attachments on the server's local disk creates a stateful dependency on the filesystem, which hinders horizontal scaling.

### Key Takeaway
- **Memory Buffer Processing**: Configure `multer` with `memoryStorage()` to handle file uploads entirely in-memory.
- **Base64 DB Persistence**: Convert the memory buffers directly into base64 Data URLs (`data:${file.mimetype};base64,...`) and return them to the client. The client can then save these directly in the database as string arrays, making the application database-driven and horizontally scalable.

---

## 5. Prevent Scroll Hijacking in Live Streams

### Context
Auto-scrolling the chat container to the bottom on every streaming token makes it impossible for users to scroll up to read history while the assistant is writing.

### Key Takeaway
- **Scroll Hook Lock**: Monitor the scroll position of the chat container. Only execute `scrollIntoView` for incoming tokens if the user is already near the bottom (using a threshold of ~150px).
- **Escape Hatch Button**: If the user has scrolled up, disable auto-scroll and render a floating scroll-to-bottom arrow button. Clicking it re-engages the auto-scroll lock and slides the view smoothly back to the bottom.

## 6. Dynamic Input Controls for Specialized Models

### Context
Toggles like "Deep Think" or "Web Search" are only relevant to models that support those capabilities.

### Key Takeaway
- **Differentiate Pure Reasoning Models**: If a model natively reasons by default (such as DeepSeek R1), hide reasoning toggles in the UI based on model ID keywords to avoid presenting redundant or misleading settings to the user.

---

## 7. Guard API-Specific Parameters Across Model Classes

### Context
Specialized options (e.g., `thinking_config`, `thinking_budget`, or `reasoning_effort`) are supported on newer API models (e.g., Gemini 2.5 Flash/Pro) but rejected on older versions.

### Key Takeaway
- **Parameter Validation**: When mapping request parameters to provider payloads, dynamically check the model ID capabilities. Only inject parameters like `thinking_budget` if the model class supports thinking/reasoning.
- **Why**: Passing these unrecognized parameters to non-thinking models (e.g. Gemini 1.5 Flash/Pro, Gemini 2.0 Flash) causes the provider endpoint to return a `400 Bad Request` error. Always ensure properties are conditionally set.

---

## 8. Correctly Configure Gemini 2.5 Thinking in OpenAI-Compatible API

### Context
When using the OpenAI compatibility layer for Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/`), passing custom Gemini parameters via `extra_body` (like `thinking_config`) causes the API to return a `400 Bad Request` error.

### Key Takeaway
- **Use Standard Parameters**: Enable or disable reasoning using the standard OpenAI `reasoning_effort` parameter (`'none'` or `'medium'`). The compatibility layer automatically translates this into the correct thinking budgets for Gemini 2.5 models.
- **Support Reasoning Streams**: Ensure that the stream processing loop parses and passes forward `delta.reasoning_content` to the UI's `thinkingContent` chunk handler to correctly render the model's intermediate thoughts.

---

## 9. Avoid Destructive Token Clearing on Network Failures

### Context
When the server is stopped, restarted, or experiences brief downtime, client-side requests (such as automatic authentication checks or token refreshes) fail with standard network errors (e.g., `TypeError: Failed to fetch`).

### Key Takeaway
- **Distinguish Auth Errors from Network Dropouts**: Only call `clearTokens()` and force a user logout when the server returns explicit authorization rejection codes (e.g., `401 Unauthorized`, `403 Forbidden`, `404 User Not Found`).
- **Retain Tokens on Network Failure**: If a fetch fails due to network downtime (e.g., connection refused, offline status), the client should keep the local storage tokens intact. Once the server comes back online, the next request or page refresh will seamlessly re-authenticate the user without requiring them to log in again.
