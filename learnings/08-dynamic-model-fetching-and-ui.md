# Dynamic Model Fetching & UI Overhaul

## 1. Dynamic Model Discovery
To support the dynamic listing of models from all 5 providers (NVIDIA NIM, Groq, OpenRouter, Google Gemini, and Together AI), we:
- Updated the `BaseProvider.listModels` signature to accept an optional `apiKey?: string`.
- Added authentication to the backend GET `/api/providers/:id/models` endpoint, allowing it to retrieve and decrypt the user's specific API key (if configured in Settings).
- Standardized the provider-specific client lists using standard `/v1/models` endpoints with standard fallback lists when API keys are not configured or request fails.
- Integrated merging/enrichment logic: if a dynamically fetched model ID matches a curated model, we merge rich details (such as descriptive text, context lengths, and support capabilities).

## 2. Professional UI Overhaul
Redesigned the chat application interface to follow a neutral, minimal layout inspired by industry-standard ChatGPT-style clients:
- **Clean Palette**: Transitioned from a heavy purple theme to a clean neutral dark/light palette.
- **Top 5 + More Pattern**: The model selector dynamically shows the top 5 models per provider with a toggle to expand to the full list.
- **Circular Avatars & Right-Aligned User Bubbles**: Balanced alignments to make message history look structured and intuitive.
- **Theme Toggle**: Placed on the top right for instant light/dark mode switching.
- **Server API Key Warning**: A banner that informs users when their requests are routed through a server-hosted key.
- **AI Chat Titles**: New chats now automatically receive contextual, AI-generated titles using the selected provider's LLM immediately after the first exchange.
