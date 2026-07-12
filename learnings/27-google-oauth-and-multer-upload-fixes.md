# Google OAuth Signature Verification and Multer Disk Storage Uploads

## 1. Problem Context
During a comprehensive security and optimization audit of the OpenModels application, two major concerns were identified:
- **Google OAuth Signature Bypass**: In `server/src/features/auth/routes.ts`, incoming Google JWT credentials were decoded directly via base64 decoding (`credential.split('.')`) without signature or audience verification. A malicious user could forge a token with any email address and take over any account.
- **Database Bloat from Base64 Images**: Uploaded images in `/api/chat/upload` were handled in-memory and returned as large base64 data URLs. Saving these megabytes-long base64 strings in the database's `Message` table degrades database performance, increases load latency, and inflates the database storage footprint quickly.

---

## 2. Solutions Implemented

### A. Cryptographic Verification of Google ID Tokens
We integrated Google's official verification library `google-auth-library` to validate ID token signatures, issuers, and audiences:
1. Installed the `google-auth-library` dependency.
2. Initialized `OAuth2Client` with the server's configured client ID.
3. Updated the `/api/auth/google` POST handler to verify the ID token:
```typescript
import { OAuth2Client } from 'google-auth-library';
const googleClient = new OAuth2Client(config.google.clientId);

// Verify token cryptographically
const ticket = await googleClient.verifyIdToken({
  idToken: credential,
  audience: config.google.clientId,
});
const payload = ticket.getPayload();
if (!payload) {
  res.status(401).json({ error: 'Failed to verify Google token' });
  return;
}
const { sub: googleId, email, name, picture } = payload;
```

### B. Multer Disk Storage & Relative Asset Paths
To prevent database size bloat and improve response times, we transitioned image storage from memory to disk:
1. Reconfigured Multer to use `diskStorage` and save files to the `server/uploads` folder:
```typescript
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../../uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});
```
2. Updated the `/api/chat/upload` endpoint to return the relative server path `/uploads/filename` instead of the base64 data URL.
3. Updated `client/vite.config.ts` to proxy static requests matching `/uploads` to the backend server (port 3001) in development:
```typescript
'/uploads': {
  target: 'http://localhost:3001',
  changeOrigin: true,
},
```

---

## 3. Verification & Smoke Test
We verified the fixes using a browser-based smoke test:
1. **Registration & Check**: Confirmed new user registration succeeded.
2. **Security Check**: Verified that logins with unverified emails are successfully blocked with a `403 Forbidden` status.
3. **Anonymous Chat Flow**: Verified that anonymous user chat messages function properly and receive full responses from the AI.
4. **Vite Proxy & Multer Check**: Confirmed client static assets are successfully routed and served through the Vite proxy configurations.
