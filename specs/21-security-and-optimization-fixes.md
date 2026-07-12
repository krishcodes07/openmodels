## Codebase Security & Storage Optimization Fixes

This specification details the critical security flaws and optimization improvements that need to be resolved immediately in the OpenModels codebase.

---

### 1. Google OAuth Token Cryptographic Verification
* **Problem**: In `server/src/features/auth/routes.ts`, when a user signs in via Google OAuth, the server receives the `credential` JWT token and extracts the user details by simply splitting and base64-decoding the payload (`credential.split('.')`). It never verifies the cryptographic signature or audience.
* **Security Risk**: A malicious actor could easily forge a JWT header and payload containing any target user's email address and send it to the `/api/auth/google` endpoint, leading to complete account takeover without ever possessing the user's password or Google credentials.
* **Required Fix**:
  - Install `google-auth-library` in the backend.
  - Implement signature and audience validation using Google's official OAuth2 client:
    ```typescript
    import { OAuth2Client } from 'google-auth-library';
    const client = new OAuth2Client(config.google.clientId);
    
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.google.clientId,
    });
    ```

---

### 2. Database Bloat from Raw Base64 Vision Attachments
* **Problem**: When users upload images, `/api/chat/upload` processes them using Multer in-memory storage and returns them as raw Base64 data URLs. These large base64 strings are stored directly in the `imageUrls` (`TEXT[]`) array of the `Message` table in the database.
* **Performance Risk**: Storing megabytes of base64 strings inside row fields in PostgreSQL consumes immense database memory/disk, drastically slows down query loading speeds when reading conversation history, and degrades overall server response times.
* **Required Fix**:
  - Update `/api/chat/upload` to write uploaded files to the filesystem in `server/uploads/` (or dedicated object storage).
  - Return the server file url (e.g. `http://localhost:3001/uploads/...` or `/uploads/...`) to the client.
  - Store standard URLs in the `Message` table instead of raw base64 data strings.
