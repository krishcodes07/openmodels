# Mobile Responsiveness & UI/UX Improvements

This document outlines key learnings, implementation patterns, and styling strategies established while optimizing OpenModels for mobile devices and fixing layout/state inconsistencies.

---

## 1. Responsive Sidebar & Panel Drawers (Overlay vs. Squeezed Layouts)

### Problem
In multi-column flex layouts (e.g., `Sidebar | Chat | SourcesPanel`), leaving all panels as static/relative flex items causes them to squeeze the main chat container to a narrow column when multiple panels are open on mobile screens.

### Solution
Use media-query-driven responsive positioning:
- **Desktop (md and up)**: Keep the panels inline (`static md:w-[350px]`) so they push and share layout space cleanly.
- **Mobile (below md)**: Style panels as fixed overlays (`fixed z-40 top-0 left-0/right-0 w-full sm:w-[350px] h-full shadow-2xl`) so they slide in over the main screen content without affecting the chat container's width.
- **Example Class List**:
  ```tsx
  className="fixed md:static inset-y-0 right-0 z-40 w-full sm:w-[350px] border-l border-border bg-bg-secondary flex flex-col h-full animate-slide-right flex-shrink-0 shadow-2xl md:shadow-none"
  ```

---

## 2. Interactive Backdrop Blurs

For overlay elements like mobile sidebars, adding a simple backdrop blur dark layer enhances the premium feel and provides intuitive close targets:
```tsx
{isSidebarOpen && (
  <div
    onClick={toggleSidebar}
    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-200"
  />
)}
```

---

## 3. Touch-Friendly List Card Actions

### Problem
Hiding buttons (like Rename or Delete) behind CSS hover states (`opacity-0 group-hover:opacity-100` or `{hoveredId === id && ...}`) makes them completely inaccessible on touch-screen devices where hover events do not exist.

### Solution
Expose actions not only on mouse hover but also whenever the item is active or selected:
```tsx
{(hoveredId === conv.id || currentConversation?.id === conv.id) && (
  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
    {/* Action Buttons */}
  </div>
)}
```

---

## 4. Scroll Containment in Multi-Tab Settings Pages

### Problem
On mobile screens, long settings forms cause the entire page to scroll, pushing the top horizontal tab bar out of view, forcing the user to scroll all the way back up to switch tabs.

### Solution
Prevent page-level scrolling and isolate scrolling inside the tab content pane:
1. Make the outer wrapper `h-screen overflow-hidden`.
2. Keep the header and navigation bar as `flex-shrink-0` layout items.
3. Apply `overflow-y-auto h-full` to the `<main>` settings content component.
This guarantees the navigation sidebar (desktop) or horizontal tab bar (mobile) remains sticky at the top/left, while only the form inputs scroll.

---

## 5. Atomic State Transitions during Async Fetches

### Problem
When changing a provider, the provider ID updates immediately, but fetching its models list is asynchronous. If the old model ID remains selected while the network request resolves, the UI displays mismatched text (e.g., `Google Gemini > gpt-4.1`).

### Solution
Update state atomically in the store. When initiating a provider switch, instantly clear the selected model and models list to trigger loading states in the header before launching the async fetch:
```typescript
selectProvider: async (providerId: string) => {
  set({
    selectedProviderId: providerId,
    selectedModelId: '',
    models: [],
  });
  try {
    const data = await api.getModels(providerId);
    set({ models: data.models });
    if (data.models.length > 0) {
      set({ selectedModelId: data.models[0].id });
    }
  } catch (error) {
    console.error(error);
  }
}
```

---

## 6. CSS-Only Responsive Tables in Markdown

By default, HTML tables (`<table>`) in markdown render with `display: table`, which can overflow parent margins on narrow screens. Setting the table to `display: block` with horizontal scroll properties makes them scrollable on mobile:
```css
.prose table {
  display: block;
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}
```

---

## 7. AI Title Generation for Anonymous Guest Chats

Even when database writes are bypassed (guest users), the backend can still generate and stream chat titles. By verifying if the request history is empty/contains one message, the server triggers the LLM title generator and streams it back via server-sent events (`type: 'title'`). The client then captures and updates the title inside its LocalStorage-managed guest sessions list.

---

## 8. Graceful Database Writes on Deleted Conversations (SSE Lifecycle)

### Problem
Because streaming responses takes time (usually several seconds), a user has the opportunity to delete a conversation while the stream is actively running. When the backend finally completes the stream, it tries to save the assistant's message and update the conversation timestamp in the database. Since the conversation record has already been cascade-deleted, this attempt triggers a foreign key constraint violation (`messages_conversationId_fkey`) and crashes the route handler.

### Solution
Wrap post-stream database operations (like creating the assistant's response message and updating the conversation timestamp) in safe `try/catch` blocks. If the conversation has been deleted, log a warning instead of failing the request or throwing unhandled database exceptions.

---

## 9. Dynamic Initial Store State for Viewport Responsiveness

### Problem
Defaulting UI layout toggles (like `isSidebarOpen`) to `true` at the state store level forces a desktop layout to render initially. On mobile screens, this causes the sidebar to start open and flashes the sidebar drawer on initial mount before any `useEffect` screen resize handlers can run and hide it.

### Solution
Evaluate the viewport width dynamically at store initialization time:
```typescript
isSidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true
```
This guarantees the sidebar defaults to `false` (closed) on mobile viewports on the very first React layout pass, preventing any layout flashing.

---

## 10. Direct Scroll Container Control vs. scrollIntoView

### Problem
Using `element.scrollIntoView({ behavior: 'smooth' })` on deep DOM elements can cause mobile web browsers (especially iOS Safari and mobile Chrome) to scroll the entire browser window viewport upward. Since the main layout uses `overflow-hidden`, this pushes the header (`ChatHeader`) off-screen with no way for the user to scroll back down to see it.

### Solution
Instead of targeting deep nodes with `scrollIntoView`, scroll the local scroll container directly:
```typescript
const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
  const container = scrollContainerRef.current;
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }
};
```
This keeps all scroll interactions 100% contained within the message window, preserving the absolute coordinates of the viewport and keeping the pinned header visible.

---

## 11. Viewport Height vs. Keyboard Resizing (dvh unit)

### Problem
Static viewport heights (`h-screen` which maps to `100vh`) do not shrink when the mobile soft keyboard is opened. The keyboard overlays the bottom of the layout, completely obscuring the chat input area.

### Solution
Use the Dynamic Viewport Height (`100dvh`) unit for the main layout wrapper:
```html
<div className="flex h-screen h-[100dvh] bg-bg-primary overflow-hidden">
```
Browsers resize `100dvh` dynamically when the keyboard expands, keeping the entire chat input area fully visible above the keyboard.

---

## 12. Centered Overlay Popovers for Mobile Dropdowns

### Problem
Positioning absolute dropdown menus relative to small buttons (`left-0` or `right-0`) on mobile screens causes layout shifts, overflow, or awkward positioning because the dropdown extends off-screen boundaries.

### Solution
Convert dropdowns to centered overlay sheets on mobile screens by combining `fixed` positioning with viewport-relative centering, falling back to absolute positioning on desktop:
```css
fixed sm:absolute top-12 sm:top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-[92vw] sm:w-72 max-w-[340px]
```
This aligns the menus cleanly under the header as screen-centered modal popovers on mobile, while retaining context-sensitive desktop layouts.

---

## 13. Directional Scroll Tracking for Stream Control

### Problem
When content is streaming rapidly (every 20–50ms), the state updates trigger `scrollToBottom()`. If the user attempts to scroll up manually to read earlier messages, the continuous auto-scroll triggers override their manual position, snapping the viewport back to the bottom.

### Solution
Track the scroll direction using `lastScrollTopRef`. If `scrollTop` decreases, the scroll action was manual and directed upward; set `shouldAutoScrollRef.current = false`. If the user scrolls back to the bottom (within a threshold) or sends a new message, reactivate auto-scroll:
```typescript
const handleScroll = () => {
  const container = scrollContainerRef.current;
  if (!container) return;

  const currentScrollTop = container.scrollTop;

  // Set auto-scroll to false if the user manually scrolled up
  if (currentScrollTop < lastScrollTopRef.current) {
    shouldAutoScrollRef.current = false;
  }

  // Set auto-scroll back to true if the user scrolls to the bottom
  const isAtBottom = container.scrollHeight - currentScrollTop - container.clientHeight <= 50;
  if (isAtBottom) {
    shouldAutoScrollRef.current = true;
  }

  lastScrollTopRef.current = currentScrollTop;
};
```
This allows the user to freely read history without snapping, while maintaining smooth auto-scroll when they are at the bottom of the conversation.



