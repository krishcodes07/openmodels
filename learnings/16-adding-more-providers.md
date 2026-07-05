# Adding More Free / Evaluation AI Providers

## Context & Objectives
To expand the number of supported AI inference providers in the application, specifically focusing on providers offering free tiers, evaluation credits, or developer access, following the registry pattern of OpenModels.

## Key Actions Taken

### 1. New Providers Added
We implemented 10 new providers in `server/src/providers/`:
- **Together AI (`together`)**: Popular open-weights host. Supports dynamic model listing, vision models, and streaming.
- **Mistral AI (`mistral`)**: Developer-friendly European AI lab models.
- **GitHub Models (`github`)**: Completely free evaluation endpoint for anyone with a GitHub account.
- **Cerebras (`cerebras`)**: Extremely low latency CS-3 wafer-scale inference engine.
- **SambaNova (`sambanova`)**: Ultra-fast SN40L dataflow engine hosting Llama and DeepSeek R1.
- **HuggingFace Inference Providers (`huggingface`)**: Gateway to free/dedicated model APIs hosted on the Hugging Face Hub.
- **Vercel AI Gateway (`vercel`)**: Observability and caching proxy.
- **OpenCode Zen (`opencode`)**: Quality-curated developer coding models.
- **Cohere (`cohere`)**: Conversational enterprise search and RAG models.
- **Cloudflare Workers AI (`cloudflare`)**: Edge GPU-accelerated serverless model inference.
- **Z.AI (`zai`)**: Developer API for Zhipu GLM series, offering flagship reasoning and multimodal vision support.

### 2. Native Reasoning / Thinking Support
- Where reasoning models are run (e.g. DeepSeek-R1 on Together AI or SambaNova), they stream reasoning tokens via the `reasoning_content` key.
- Z.AI controls deep reasoning dynamically via `thinking: { type: "enabled" | "disabled" }` and the `reasoning_effort` parameter, streaming thoughts under `reasoning_content` or `thinking`.
- Custom delta extraction maps these keys to `thinkingContent` chunk output to display reasoning processes natively.

### 3. Dynamic Configuration & Environment Variables
- Added API key configuration keys to:
  - `server/src/config/index.ts`
  - `.env`
  - `.env.example`
- The frontend settings UI automatically queries available providers from the backend registry. No frontend settings view edits were required to support entering API keys for these new systems.

---

## Model Listing and Specifications for New Additions

### Z.AI
- **Base URL**: `https://api.z.ai/api/paas/v4`
- **Models Endpoint**: `GET /models`
- **Known Models**: `glm-5.2` (Flagship Reasoning), `glm-5.1` (Planning), `glm-5v-turbo` (Multimodal Vision), `glm-5-turbo` (High-throughput Agent tasks)
- **Authentication**: Bearer token via `ZAI_API_KEY`
