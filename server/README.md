# OpenModels Server

This directory contains the Express + Node.js backend codebase for **OpenModels**.

For full information on configuring environment variables, setting up the PostgreSQL database via Prisma ORM, and deploying, please refer to the **[Main Root README.md](../README.md)**.

## 🛠️ Server Tech Stack
- **Framework**: Express 4 + TypeScript
- **Runtime Dev Runner**: `tsx`
- **Database ORM**: Prisma (PostgreSQL)
- **Encryption**: AES-256-GCM (Node.js `crypto` library)
- **Authentication**: JWT + Cookie parser
- **AI Integrations**: OpenAI Node SDK wrapper for all compatible API services
