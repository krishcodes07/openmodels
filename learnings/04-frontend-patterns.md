# Frontend Patterns & Gotchas

## TailwindCSS v4 — CRITICAL

This project uses **TailwindCSS v4** (via `@tailwindcss/vite` plugin), NOT v3.

### Key Differences from v3:
- **No `tailwind.config.js`** — configuration lives in CSS via `@theme {}` block
- **No PostCSS config** — uses Vite plugin directly
- **CSS Layers** — Tailwind v4 puts utilities inside `@layer utilities`. Custom CSS rules MUST be inside `@layer base` or they will override utility classes due to CSS cascade rules (unlayered > layered).
- **`@theme {}` block** — defines design tokens (colors, fonts, radii, shadows, animations)
- **Color naming** — `--color-bg-primary` becomes `bg-bg-primary` in classes
- **Custom animations** — defined as `--animate-*` in `@theme` for use with `animate-*` utility classes

### Common Mistake to AVOID:
```css
/* ❌ WRONG — unlayered rules override ALL Tailwind utilities */
* { margin: 0; padding: 0; }

/* ✅ CORRECT — wrap in @layer base */
@layer base {
  body { background: var(--color-bg-primary); }
}
```

## Design System (index.css)

Located at `client/src/index.css`. Key tokens:

| Token Pattern | Example | Usage |
|---|---|---|
| `bg-bg-*` | `bg-bg-primary`, `bg-bg-secondary`, `bg-bg-hover` | Background layers |
| `text-text-*` | `text-text-primary`, `text-text-secondary`, `text-text-muted` | Text hierarchy |
| `border-border` | `border-border` | Border color |
| `bg-accent` | `bg-accent`, `hover:bg-accent-hover` | Primary accent (purple #6c5ce7) |
| `text-success/error/warning/info` | `text-error` | Semantic colors |
| `shadow-glow` | `shadow-glow` | Purple glow effect |
| `font-mono` | `font-mono` | JetBrains Mono |

Custom animation classes: `animate-fade-in`, `animate-slide-left`, `animate-slide-right`, `animate-pulse-dots`, `animate-shimmer`

## Zustand Store Patterns

Stores use the simple Zustand pattern (no middleware):
```typescript
const useStore = create<State>((set, get) => ({
  // state
  data: [],
  // actions (async)
  fetchData: async () => {
    const result = await api.getData();
    set({ data: result });
  },
  // actions using current state
  doSomething: () => {
    const current = get();
    set({ data: [...current.data, newItem] });
  },
}));
```

## Streaming Chat Flow

1. User types message → `chatStore.sendMessage(content)`
2. User message added optimistically to `messages[]`
3. `isStreaming = true`, `streamingContent = ''`
4. `api.streamChat()` reads SSE events from `/api/chat`
5. Each `content` event appends to `streamingContent` (displayed with typing cursor)
6. Each `thinking` event appends to `thinkingContent` (displayed in separate box)
7. On `done` event: finalized `ASSISTANT` message added to `messages[]`, `isStreaming = false`
8. Conversations list refreshed

## Routing

```
/auth                → AuthPage (public)
/                    → ChatLayout with WelcomeScreen (protected)
/chat/:conversationId → ChatLayout with loaded conversation (protected)
/settings            → SettingsPage (protected)
```

`ProtectedRoute` in `App.tsx` redirects to `/auth` if not authenticated.

## API Client (`services/api.ts`)

- Singleton `ApiClient` class
- Stores access/refresh tokens in localStorage
- Auto-refreshes access token on 401 response
- `streamChat()` uses fetch + ReadableStream for SSE parsing
- All methods return parsed JSON
