# Production Deployment Guide

This document explains how to deploy OpenModels in a production environment.

---

## ☁️ Vercel Deployment (Serverless)

OpenModels is configured for easy serverless deployment on Vercel.

### Structure Breakdown
- **Client (Frontend)**: Compiled statically via Vite and served by Vercel's global CDN.
- **Server (Backend)**: Runs as a Vercel Serverless Function. The entry point is `api/index.ts`, which exports the main Express server app.

### Configuration (`vercel.json`)
The routing configurations redirect all `/api/*` requests to the serverless function, and other paths to the static HTML:
```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

### Steps to Deploy on Vercel
1. Install the Vercel CLI globally or use the Vercel Dashboard.
2. Link your repository.
3. Configure the following environment settings in the Vercel Dashboard:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/dist`
   - Set all production environment variables (e.g. `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, etc.).

---

## 🐳 Docker Deployment

For VPS, AWS, or local on-premise container deployments, you can containerize the server and client.

### Dockerfile (Root level or Server)
Create a multi-stage Docker build to package both the React frontend assets and the Express backend node application.

Example `Dockerfile`:

```dockerfile
# Stage 1: Build the client
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build the server
FROM node:18-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine
WORKDIR /app
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package*.json ./server/
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY --from=client-builder /app/client/dist ./client/dist

# Set production env vars
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
```

---

## 🗄️ Database Migrations in Production

Unlike development which uses `db:push` to sync database schemas directly, production environments should run official migrations:

1. Ensure `DATABASE_URL` is pointed to your production PostgreSQL cluster.
2. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```
   This command applies any pending migrations to the target database without resetting records.
3. If seeding is required, run:
   ```bash
   npx prisma db seed
   ```

---

## 📝 Environment Variables Reference

| Variable | Description | Example | Required |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` | Yes |
| `JWT_SECRET` | Secret key for access token encryption | `a_long_random_string` | Yes |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | `another_long_random_string` | Yes |
| `ENCRYPTION_KEY` | 32-byte (64 char) hex key for API keys | `7c21...e0fa` | Yes |
| `PORT` | Server listening port | `3001` | No (Defaults to 3001) |
| `CLIENT_URL` | Frontend URL for CORS mapping | `https://open-models.vercel.app` | Yes |
| `GOOGLE_CLIENT_ID` | OAuth Client ID | `...googleusercontent.com` | No (OAuth fallback) |
| `GOOGLE_CLIENT_SECRET`| OAuth Client secret | `GOCSPX-...` | No |
| `FIRECRAWL_API_KEY` | Realtime search API key | `fc-...` | No (Search fallback) |
