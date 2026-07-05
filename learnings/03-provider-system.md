# Provider System

## How It Works

All AI providers implement the abstract `BaseProvider` class from `server/src/providers/base.provider.ts`.

### BaseProvider Interface

```typescript
abstract class BaseProvider {
  abstract readonly info: ProviderInfo;        // { id, name, description, requiresApiKey }
  abstract listModels(): Promise<ProviderModel[]>;
  abstract chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse>;
  abstract streamChat(request: ChatRequest, onChunk: (chunk: StreamChunk) => void, apiKey?: string): Promise<void>;
  getApiKey(userApiKey?, platformApiKey?): string;  // prebuilt helper
}
```

### Key Types

```typescript
interface ProviderModel {
  id: string;           // e.g. "meta/llama-3.3-70b-instruct"
  name: string;         // e.g. "Llama 3.3 70B Instruct"
  description?: string;
  contextLength?: number;
  capabilities: ModelCapabilities;
}

interface ModelCapabilities {
  supportsVision: boolean;
  supportsThinking: boolean;
  supportsWebSearch: boolean;
  supportsStreaming: boolean;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  thinking?: boolean;
  webSearch?: boolean;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}
```

### Registry Pattern

`server/src/providers/registry.ts` is a singleton `ProviderRegistry`:
- `register(provider)` — adds provider by its `info.id`
- `get(id)` — returns provider or undefined
- `getAll()` — returns all providers
- `getAllInfo()` — returns info objects (used by `/api/providers` endpoint)

## Current Providers

### NVIDIA NIM (`nvidia`)
- Base URL: `https://integrate.api.nvidia.com/v1`
- Uses OpenAI SDK as client
- Models: Llama 3.3 70B, Llama 3.1 8B/70B, Nemotron 70B, DeepSeek R1, Gemma 2 27B, Phi 3 Medium
- DeepSeek R1 has `supportsThinking: true`

### Groq (`groq`)
- Base URL: `https://api.groq.com/openai/v1`
- Uses OpenAI SDK as client
- Models: Llama 3.3 70B, Llama 3.1 8B, Llama 3.2 11B Vision, DeepSeek R1 Distill 70B, Gemma 2 9B, Mixtral 8x7B
- Llama 3.2 11B Vision has `supportsVision: true`
- DeepSeek R1 Distill has `supportsThinking: true`

## Adding a New Provider

1. Create `server/src/providers/newprovider.provider.ts`
2. Extend `BaseProvider`, implement all abstract methods
3. In `server/src/providers/registry.ts`, add:
   ```typescript
   import { NewProvider } from './newprovider.provider';
   providerRegistry.register(new NewProvider());
   ```
4. Add API key env var to `.env.example` and `server/src/config/index.ts`
5. **No frontend changes needed** — the UI discovers providers/models via API

## API Key Flow

1. Platform-level keys in `.env` (shared, for free tiers)
2. Per-user keys stored encrypted in `user_api_keys` table (AES-256-GCM)
3. At chat time: user key takes priority over platform key
4. If neither exists, error: "No API key configured for {provider}"
