# Landing Page and Anonymous Chat Limits

This learning documents the implementation of the unauthenticated landing page and anonymous chat limit features.

## 1. Optional Authentication Middleware
- **File**: `server/src/middleware/auth.ts`
- **Pattern**: Created `optionalAuthenticate` middleware to parse the JWT authorization header. If the token is missing or invalid, it simply sets `req.user = undefined` instead of sending a `401 Unauthorized` response. This allows guest users to make requests to platform APIs.

## 2. Server-Side Anonymous Stream Chat
- **File**: `server/src/features/chat/routes.ts`
- **Pattern**:
  - Modified POST `/api/chat` to use `optionalAuthenticate`.
  - When `req.user` is undefined (anonymous request):
    - Replaces database lookups with the custom `messages` payload passed in `req.body.messages` to reconstruct conversation history.
    - Bypasses prisma calls to save conversation, message logs, and usage trackers.
    - Utilizes server/platform configured keys (e.g. `config.providers.nvidia.apiKey`) to make requests.
    - Sends a `usingServerKey` flag in the event stream if platform keys are utilized.

## 3. Client-Side Guest Store Persistence
- **File**: `client/src/stores/chatStore.ts`
- **Pattern**:
  - Initialized `anonymousConversations`, `anonymousMessages`, and `anonymousMessageCount` by parsing them from `localStorage` to ensure chat history and limits persist across page refreshes.
  - In `sendMessage`, `deleteConversation`, and `renameConversation` handlers, updated the store state and synchronized the state to `localStorage`.
  - Incremented the message count for each user request. Once it reaches `5`, opened `showAuthLimitModal` and blocked further outgoing messages.

## 4. UI Adaptations for Guest Users
- **Chat Header**:
  - When `isAuthenticated` is false, replaces the Settings icon with custom, premium styled "Log In" and "Sign Up" buttons.
  - Navigates to `/auth?mode=login` and `/auth?mode=signup` respectively.
- **Auth Page**:
  - Uses `useSearchParams` to read the `mode` query parameter.
  - Switches the active tab state (`isLogin`) to signup or login accordingly on mount.
- **Sidebar Footer**:
  - Renders a premium Guest prompt invitation card instead of user profile details when signed out, encouraging registration to save chat histories.
- **Chat Input & Modal**:
  - Disables all input fields, deep think, search, and send buttons when the 5-message session limit is reached.
  - Renders an inline alert callout with a glowing action button and a fullscreen glassmorphism popup modal with benefits listed (e.g., Save Chat History) to incentivize account creation.

## 5. Prevent Router Unmounting During Auth Actions
- **Issue**: Previously, `login`, `register`, and `googleLogin` asynchronous operations inside `useAuthStore` set `isLoading: true` while the request was in flight. This caused `App.tsx` to unmount the entire `BrowserRouter` to render a full-screen loading spinner. Consequently, the active `AuthPage` component was destroyed before navigation occurred, preventing the successful `navigate('/')` redirect.
- **Fix**: Replaced the use of `isLoading` with a separate `authActionLoading` state during sign in/up operations. This keeps the `BrowserRouter` mounted throughout the entire auth lifecycle, ensuring the `navigate('/')` redirect is successfully executed, instantly mounting the new chat interface.
