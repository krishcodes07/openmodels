# Email Verification Flow and Message Limits

In this session, we designed and implemented a secure, premium-styled email verification system for registered users using email/password authentication, complete with automatic 5-message limit enforcement for unverified accounts and a seamless verification-to-login transition.

## Key Accomplishments

### 1. Database Schema Extensions
- **Implementation**: Added three tracking fields to the Prisma `User` model in `schema.prisma`:
  - `emailVerified` (`Boolean` default `false`): Tracks whether the email has been confirmed.
  - `verificationToken` (`String? @unique`): Holds a cryptographically generated 32-byte hex token.
  - `verificationTokenExpires` (`DateTime?`): Sets a 24-hour expiration window on the token.
- **Migration & Client Sync**: Terminated background node processes to release lock handles on database binaries, executed `npm run db:push` to sync database columns, and regenerated the Prisma Client (`npx prisma generate`).

### 2. NodeMailer Integration
- **Mailer wrapper**: Created a robust helper at `server/src/lib/mailer.ts` using `nodemailer`.
- **Premium Design**: Built a beautifully styled HTML template following the **OpenModels** dark mode brand colors, embedding clean CSS gradients, pill buttons, and responsive fallback copy.
- **Developer Experience**: Added logging in development mode to output the raw verification URL directly to the terminal logs:
  `[Mailer] [DEV ONLY] Verification link: http://localhost:5173/api/auth/verify?token=...`
  This enables rapid testing without accessing actual email inboxes.

### 3. Verification & Authentication Routes Hardening
- **Registration**: Allows direct login on sign-up (per specifications) so users can try the product instantly. It generates a 24-hour verification token, updates the database, and dispatches the verification mail asynchronously.
- **Login Block**: Blocks login attempts for unverified accounts with `403 Forbidden` (`code: 'EMAIL_UNVERIFIED'`). The backend automatically checks if a token is missing/expired, regenerates it, updates the DB, and dispatches a fresh verification link.
- **Direct GET `/verify` Route**: Validates the token, marks `emailVerified: true`, and clears the token parameters in a single transaction.
- **OAuth Google Sign-in**: Automatically marks users as `emailVerified: true` since Google validates emails at the provider layer.

### 4. Message Limit Enforcement
- **Limit Checks**: Injected message counters in `POST /api/chat`, `POST /api/chat/regenerate`, and `POST /api/chat/edit` endpoints before the SSE headers are written.
- **Enforcement**: If `user.emailVerified === false`, counts the total `role: 'USER'` messages across all conversations in the database. Denies the request with a `403` JSON payload if the count is `>= 5`.

### 5. UI/UX Banner & Auto-Login Flow
- **Error Banners & Resends**: Updated `AuthPage.tsx` to handle verification tokens, error responses, and render a "Resend Verification Email" link on login block.
- **Interactive Chat Input Banner**: Added an elegant alert banner above `ChatInput.tsx` for unverified, logged-in users to notify them of the 5-message limit and allow resending the verification email in one click.
- **Automatic Login on Verification**: Modified the backend verification link callback to generate active session tokens (`accessToken` and `refreshToken`) and redirect the browser with these values in the URL hash/query string. The frontend extracts the tokens, saves them, triggers a quick `checkAuth()`, and redirects the user directly to the chat dashboard, creating a seamless experience.

## Engineering Takeaways

- **EPERM Binary Locks during Generation**: Active Node.js runtime processes (e.g., Express servers or hot-reloading dev servers) lock the Prisma Client's underlying `.node` binary files. Running `npx prisma generate` when these servers are active will fail with `EPERM`. Terminating active Node runtimes is required before recompiling database client schemas.
- **SSE Stream Exception Boundaries**: When writing server-sent event (SSE) streams, validation and authorization checks (such as checking verification status and message limits) must happen *before* writing the `Content-Type: text/event-stream` header. If headers are written, the server cannot return a clean JSON error status code like `403 Forbidden` directly to the client.
- **Session Handshakes via Query Redirects**: Passing short-lived authentication tokens inside secure redirects allows cross-origin redirection links (e.g., from email clients to the browser application) to automatically authenticate sessions without making users re-enter credentials.
