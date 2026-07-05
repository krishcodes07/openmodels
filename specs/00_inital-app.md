# Build OpenModels - AI Chat Platform

## Project Overview

Build a modern AI chatbot SaaS platform named **OpenModels**.

OpenModels is similar to ChatGPT, Claude, Gemini, Perplexity, etc., but with one major difference:

Instead of providing our own proprietary models, OpenModels acts as a unified interface for **multiple AI providers**, allowing users to chat with any supported model from a single application.

Initially, the platform will focus on **free models** available through providers such as:

* NVIDIA NIM
* Groq
* OpenRouter (free models)
* Together AI (future)
* Cerebras (future)
* DeepInfra (future)
* SambaNova (future)

The provider system must be completely dynamic so adding a new provider later should require minimal work.

The project should be designed as a production-ready SaaS application with clean architecture, scalability, and maintainability in mind.

---

# Important

The attached screenshots are **only design inspiration**.

**Do NOT copy the UI.**

Instead:

* Build a unique interface inspired by ChatGPT, Claude, Gemini and modern AI products.
* Keep the UI clean.
* Minimalistic.
* Premium.
* Fast.
* Responsive.
* Smooth animations.
* Proper spacing.
* Rounded components.
* Modern typography.

---

# Tech Stack

Frontend

* React
* TypeScript
* TailwindCSS
* React Router
* Zustand (or equivalent)
* React Query / TanStack Query

Backend

* Node.js
* Express
* TypeScript

Database

* PostgreSQL
* Prisma ORM

Authentication

* Google OAuth
* Email Authentication

---

# Overall Architecture

```
Frontend
     │
     │ REST API
     ▼
Express Backend
     │
     ├── Authentication
     ├── Chat Service
     ├── Provider Manager
     ├── Conversation Manager
     ├── User Settings
     └── API Key Manager
     │
     ▼
Postgres (Prisma)

```

Provider layer

```
Provider Interface

├── Nvidia Provider
├── Groq Provider
├── OpenRouter Provider
├── Together Provider
├── Cerebras Provider
└── Future Providers...
```

Every provider should implement the same interface.

Example:

```
Provider

- listModels()
- chat()
- streamChat()
- supportsVision()
- supportsThinking()
- supportsWebSearch()
```

This makes adding future providers very easy.

---

# Features

## Authentication

Create authentication under

```
/auth
```

Support

* Google Login
* Email Login

Use environment variables.

Since credentials are not available yet, create placeholders inside:

```
.env.example
```

Include variables for

Google OAuth

JWT

Database

Provider API Keys

Session Secrets

etc.

---

# User System

Each user has:

* profile
* conversations
* settings
* API keys

Everything should be stored in PostgreSQL.

Users should never lose chat history.

---

# Conversation System

Like ChatGPT.

Each conversation has:

* title
* provider
* model
* messages
* timestamps

Support:

* create conversation
* rename
* delete
* continue existing chats

Conversation titles can later be AI-generated.

---

# Provider System

The provider architecture should be fully modular.

For Step 2, implement:

* NVIDIA
* Groq

Each provider should expose:

* available models
* capabilities

Example capabilities:

```
supportsVision

supportsThinking

supportsWebSearch

supportsStreaming
```

The frontend should automatically adapt based on these capabilities.

No hardcoded UI.

---

# API Key Management

Some providers require users to bring their own API keys.

Create a Settings page.

Settings → Providers

Example:

```
Settings

Providers

NVIDIA

API Key
*******************

[ Save ]

Groq

API Key
*******************

[ Save ]

OpenRouter

API Key
*******************

```

Keys must be encrypted before storage.

If the user selects a provider without configuring its API key,

show a modal:

> "You haven't configured an API key for NVIDIA yet."

Buttons

```
Configure API Key

Cancel
```

Redirect the user to Provider Settings.

---

# Chat Interface

The chat page should feel modern and premium.

Layout:

```
---------------------------------------------------

Sidebar

- New Chat

- Search Chats

- Conversations

- Settings

- User Profile

----------------------

Main Chat Area

Conversation

Input Area

---------------------------------------------------
```

---

# Sidebar

Contains:

* New Chat
* Search conversations
* Conversation history
* User profile
* Settings

Should support:

* collapse
* expand

Smooth animation.

---

# Chat Header

Top area

Display:

Current Provider

Current Model

Model Selector

Provider Selector

Conversation Title

---

# Model Selection

Users can select

Provider

↓

Model

Changing provider should dynamically load models from backend.

Never hardcode models.

---

# Chat Input

The input box should automatically grow while typing.

Include icons only when supported.

Possible controls:

📎 Upload Image

Visible only if

```
supportsVision == true
```

🧠 Thinking

Visible only if

```
supportsThinking == true
```

🌐 Web Search

Visible only if

```
supportsWebSearch == true
```

Send Button

Enter = Send

Shift+Enter = New Line

---

# Image Upload

If the selected model supports vision,

display a "+" or attachment icon.

Users can upload

* image
* supported files

Preview uploaded image before sending.

If the model does not support images,

hide the upload button completely.

---

# Thinking Mode

If supported,

show a Thinking toggle.

When enabled,

send

```
thinking=true
```

to backend.

If unsupported,

hide the control.

---

# Web Search

If supported,

show Web Search toggle.

Backend will later integrate search providers.

For now,

just build the UI and backend structure.

---

# Streaming Responses

Design backend for streaming.

Frontend should support

token-by-token responses.

---

# Future Features (Architecture Ready)

Although not implemented yet,

the architecture should support:

* Voice Chat
* File Analysis
* PDF Chat
* MCP Servers
* Plugins
* AI Agents
* Image Generation
* Multi-model comparison
* Prompt Library
* Shared Chats
* Team Workspaces
* Custom System Prompts
* Conversation Search
* Temporary Chats

Do not implement these now.

Just make sure the architecture allows them later.

---

# UI Design Guidelines

Create an original design inspired by modern AI applications.

The uploaded screenshots are **reference only**.

Do **not** recreate or copy them.

Design goals:

* Clean layout
* Lots of whitespace
* Rounded corners
* Soft shadows
* Excellent typography
* Smooth transitions
* Responsive on desktop and mobile
* Dark mode ready
* Accessible
* Premium SaaS feel

Avoid visual clutter.

Focus on readability and simplicity.

---

# Step 1 Deliverables

* Project setup
* React frontend
* Express backend
* Prisma setup
* PostgreSQL integration
* Authentication structure
* Provider architecture
* Dynamic model architecture
* Conversation schema
* Settings page
* API key management structure
* `.env.example`

---

# Step 2 Deliverables

Implement

* Google Authentication
* Email Authentication
* NVIDIA Provider
* Groq Provider
* Dynamic model fetching
* Conversation storage
* Provider API key management
* Chat UI
* Streaming-ready backend
* Capability-based UI rendering (vision, thinking, web search)

---

### Additional Development Guidelines

* Write clean, modular, production-quality TypeScript.
* Follow a feature-based folder structure rather than dumping everything into generic folders.
* Use SOLID principles where appropriate.
* Avoid hardcoding providers, models, or capabilities. Everything should be driven by configuration and backend APIs.
* Build reusable React components and shared backend services.
* Keep future extensibility as a primary design goal so adding a new provider should require minimal code changes.

This version gives the AI much more context, reduces ambiguity, and encourages a scalable architecture rather than a quick prototype.
