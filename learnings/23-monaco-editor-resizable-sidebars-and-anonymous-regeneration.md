# Monaco Editor Integration, Resizable Sidebars & Anonymous Limits

## 1. Client-Side Anonymous Message & Edit Limits
- **Problem**: Previously, unauthenticated (guest) users could regenerate responses and edit messages infinitely because client actions bypass the database-level authentication checks, leading to resource leaks.
- **Solution**: 
  - Intercepted unauthenticated `regenerateResponse` and `editMessage` actions in Zustand state (`messageSlice.ts`).
  - Read/write the counter (`anonymousMessageCount`) to local storage, validating it against a limit of 5.
  - Triggered the Upgrade/Auth limit modal once the count is reached.
  - Reconstructed the conversational history payload manually on the client side and passed it in the POST body to `/api/chat` directly, bypassing the authenticated `/regenerate` and `/edit` database endpoints.

## 2. Monaco Editor Integration
- **Implementation**: Swapped the simple textarea and custom line-numbers column with Monaco Editor (`@monaco-editor/react`).
- **Insights**:
  - Monaco has built-in gutter numbering, syntax highlighting, word wrap, and color block indicators, rendering code blocks significantly cleaner.
  - Languages are mapped dynamically: `js`/`javascript` -> `javascript`, `ts`/`typescript` -> `typescript`, `svg` -> `xml`, and others default to `html`.

## 3. Iframe Security Hardening
- **Vulnerability**: Running arbitrary code blocks in the sandbox with `sandbox="allow-scripts allow-same-origin"` posed a security risk as scripts could read local storage tokens, credentials, or session cookies from the main origin.
- **Resolution**: Removed `allow-same-origin` from the iframe sandbox flags in `SandboxPanel.tsx` (`sandbox="allow-scripts allow-modals"`). This ensures the iframe code runs in a sandboxed, isolated context.

## 4. Drag Resizing & Flexbox Layouts
- **Mouse Capture Overlays**: Dragging mouse cursor over an `<iframe>` or a Monaco Editor frame causes the browser to pass mousemove/mouseup events directly to those components, interrupting and breaking the parent resize listeners.
  - *Fix*: Created a full-screen transparent overlay (`z-[9999]`) activated during active drag (`isDragging`) that captures all cursor movements globally.
- **Hitbox vs. Visuals**: A thin `4px` visual border is too small for users to easily hover and click.
  - *Fix*: Made the drag handle trigger zone wider (`w-2` or `8px` centered over the border line) with a nested thin `2px` colored indicator inside that lights up on hover/drag.
- **Flexbox Squishing (`flex-shrink-0`)**: Flex layouts squeeze sidebars if screen size changes or if parent containers lack size constraints.
  - *Fix*: Applied `flex-shrink-0` to the sidebars so the browser honors their dynamic width styles.
- **Middle Column Collapse Prevention**: Sidebar dragging can crush the center content.
  - *Fix*: Added constraints inside the mouse-movement drag listeners checking that `ScreenWidth - CurrentSidebarWidth - OtherSidebarWidth >= 380px` (guaranteeing the middle chat layout keeps a minimum 380px viewport). We also set `md:min-w-[380px]` on the chat `<main>` element for extra layout protection.

## 5. CSS Position Specificity Collisions on Mobile
- **Problem**: Combining `relative` and `fixed` in the same class list causes specificity collisions on mobile viewports. If `relative` overrides `fixed`, closed elements leave phantom whitespace gaps (e.g., 256px spacing for the sidebar) that shift layout content off-screen.
- **Solution**: Separate positions strictly:
  - Mobile default: `fixed z-40 top-0 left-0`
  - Desktop override: `md:relative md:top-auto md:left-auto md:z-0`
  - This removes them from the layout flow on mobile devices so they function cleanly as overlays.
