# Authentication & Security Architecture

This document describes the security protocols, encryption mechanisms, and authentication design implemented in OpenModels.

---

## 🔑 Authentication Architecture

OpenModels implements a dual-token JWT authentication schema to keep the application stateless and secure.

### Token Lifecycle
1. **Access Token**:
   - Short-lived (expiry: `15m`).
   - Passed in request headers: `Authorization: Bearer <token>`.
   - Stored in memory / client state.
2. **Refresh Token**:
   - Long-lived (expiry: `7d`).
   - Stored in an **HTTP-only, Secure cookie** (`refreshToken`).
   - Accessible only by the server backend (cannot be read by client JavaScript, blocking XSS leaks).
   - Used to generate a new Access Token automatically upon expiration via the `/api/auth/refresh` endpoint.

### Google OAuth Integration
Authenticated sign-ins support Google SSO. 
- The client initiates OAuth using the official client library.
- The server validates the Google JWT token on the backend route (`/api/auth/google`), creates a corresponding database record, and issues the Access/Refresh token pair back to the client.

---

## 🛡️ User API Key Encryption at Rest

Users can store their own API credentials in the profile settings panel to bypass server rate limits. To protect this sensitive data, API keys are encrypted before database insertion.

### Cryptographic Setup (AES-256-GCM)
We use the Advanced Encryption Standard (AES) in Galois/Counter Mode (GCM), providing both **confidentiality** and **authenticity** (Authenticated Encryption).

- **Encryption Key**: Must be a unique 32-byte hex-encoded string defined in server environments as `ENCRYPTION_KEY`.
- **Initialization Vector (IV)**: Generated uniquely per key using `crypto.randomBytes(16)` to guarantee that encrypting the same text twice yields different ciphertexts.
- **Auth Tag**: A 16-byte buffer produced by GCM to verify that the encrypted ciphertext has not been modified.

### Database Schema Storage
The encrypted credential maps to the `UserApiKey` model:
- `encryptedKey`: Hexadecimal representation of the encrypted text.
- `iv`: Hexadecimal string of the unique initialization vector.
- `authTag`: Hexadecimal string of the authentication tag.

### Decryption Flow
When an authenticated chat request starts, the server:
1. Queries the user's `UserApiKey` for that provider.
2. Uses the shared secret `ENCRYPTION_KEY`, the key's saved `iv`, and the `authTag`.
3. Calls the built-in decryption module:
   ```typescript
   const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
   decipher.setAuthTag(authTagBuffer);
   let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
   decrypted += decipher.final('utf8');
   ```

---

## 📧 Email Verification & Message Limits

To prevent spam and server resource depletion:
- **Guest / Anonymous Users**: Guest chat sessions do not write to the PostgreSQL database. Instead, message history is kept in React client storage, capped at `5` messages per session.
- **Unverified Users**: Upon registration, an email verification token is generated and emailed to the user (via Resend or Nodemailer). While unverified, the user is capped at `5` total database messages.
- **Verified Users**: Once verified, limits are removed, and users can save unlimited chats.
