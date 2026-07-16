# Contributing to OpenModels

Thank you for your interest in contributing to OpenModels! This document provides guidelines to help you get started with contributing code, features, or bug fixes.

---

## 🤝 Code of Conduct

We are committed to fostering a welcoming and inclusive community. Please be respectful and professional in all interactions.

---

## 💻 Local Development Setup

To set up a local development instance, follow these steps:

1. **Fork and Clone**: Fork the repository on GitHub and clone your fork locally.
2. **Install Root Orchestration**: Run `npm install` at the root directory to setup concurrently scripts.
3. **Database Configuration**:
   - Go to `server/` and run `npm install`.
   - Setup a PostgreSQL database and configure `DATABASE_URL` inside your `.env` file (copied from `.env.example`).
   - Run `npx prisma db push` to synchronize the schema.
4. **Client Configuration**:
   - Go to `client/` and run `npm install`.
5. **Run Locally**:
   - Return to the root folder and start the developer scripts:
     ```bash
     npm run dev
     ```

---

## 🔀 Pull Request Workflow

1. **Create a Feature Branch**: Always branch from `main` (e.g., `feature/add-provider-x` or `bugfix/fix-chat-streaming`).
2. **Commit Messages**: Write clean, concise commit messages following conventional commits (e.g. `feat: add mistral model provider`, `fix: handle client disconnection in SSE stream`).
3. **Testing**: Test your changes locally. If making database changes, verify that the migrations generate correctly and do not break existing data.
4. **Open a PR**: Open a Pull Request from your branch to the upstream `main` branch. Provide a clear summary of changes, screenshots of UI edits (if applicable), and list any issues resolved.

---

## 🎨 Code Style & Guidelines

### TypeScript
- Write clean, fully typed TypeScript code. Avoid the use of `any` where possible.
- Use explicit return types for functions, routes, and services.
- Define parameters and configurations using clean interface types.

### React (Client)
- Use functional components with hooks.
- For global client state management, write custom Zustand stores in `client/src/stores/`. Follow the sliced store pattern.
- Style UI components using **TailwindCSS v4** classes. Rely on variables in `client/src/index.css` for theme integration.
- Utilize semantic HTML elements (`<main>`, `<section>`, `<header>`, `<aside>`, etc.) and include descriptive, unique `id` values for interactive items.

### Express (Server)
- Keep routing structures modular and feature-oriented (e.g. `server/src/features/auth/`, `server/src/features/chat/`).
- Use Express middleware for validation, routing control, and authentications.
- Implement robust try-catch error blocks in API handlers, ensuring that resources like streaming SSE connections are cleanly ended on exceptions.

---

## 🔌 Adding a Custom Provider

If you are adding a new AI model provider, please review the detailed [Adding a New AI Provider Guide](file:///d:/Big%20Projects/openmodels/docs/provider-guide.md).

Key Checklist:
1. Extend `BaseProvider` inside `server/src/providers/yourprovider.provider.ts`.
2. Map default environment variable keys in `server/src/config/index.ts`.
3. Register the provider inside the registry in `server/src/providers/registry.ts`.
4. Run testing commands to confirm list models and stream chat responses work.
