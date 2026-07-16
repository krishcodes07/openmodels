# Adding a New AI Provider

This developer guide details how to extend the provider system in OpenModels to add a new AI provider.

---

## 🏗️ The Provider Model

All AI providers in OpenModels are classes that extend the abstract base class `BaseProvider` (`server/src/providers/base.provider.ts`). 

### The `BaseProvider` Interface
To add a new provider, you must implement the following three abstract items:

```typescript
export abstract class BaseProvider {
  // Metadata about the provider (ID, User-facing Name, Description, Icon, API Key necessity)
  abstract readonly info: ProviderInfo;

  // Asynchronous list of available models for the provider
  abstract listModels(apiKey?: string): Promise<ProviderModel[]>;

  // Non-streaming chat generation
  abstract chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse>;

  // Streaming chat generation via callbacks
  abstract streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    apiKey?: string
  ): Promise<void>;
}
```

---

## 🛠️ Step-by-Step Implementation

### Step 1: Create the Provider File
Create a new file in `server/src/providers/` named `yourprovider.provider.ts`.

Here is a template implementation for an OpenAI-compatible API endpoint:

```typescript
import { BaseProvider, ProviderInfo, ProviderModel, ChatRequest, ChatResponse, StreamChunk } from './base.provider';
import OpenAI from 'openai';
import { config } from '../config';

export class YourProvider extends BaseProvider {
  readonly info: ProviderInfo = {
    id: 'yourprovider',
    name: 'Your Provider',
    description: 'High-performance AI model provider.',
    requiresApiKey: true,
  };

  private getClient(apiKey?: string): OpenAI {
    const key = this.getApiKey(apiKey, config.providers.yourprovider?.apiKey);
    return new OpenAI({
      apiKey: key,
      baseURL: 'https://api.yourprovider.com/v1',
    });
  }

  async listModels(apiKey?: string): Promise<ProviderModel[]> {
    try {
      const client = this.getClient(apiKey);
      const list = await client.models.list();
      
      return list.data.map(m => ({
        id: m.id,
        name: m.id.split('/').pop() || m.id,
        capabilities: {
          supportsVision: m.id.includes('vision'),
          supportsThinking: m.id.includes('thinking') || m.id.includes('r1'),
          supportsWebSearch: true, // Configurable capability
          supportsStreaming: true,
        }
      }));
    } catch (err: any) {
      console.error('[YourProvider] Failed to list models:', err.message);
      return []; // Return empty list or fallback models
    }
  }

  async chat(request: ChatRequest, apiKey?: string): Promise<ChatResponse> {
    const client = this.getClient(apiKey);
    
    const response = await client.chat.completions.create({
      model: request.model,
      messages: request.messages as any,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    });

    return {
      content: response.choices[0].message.content || '',
    };
  }

  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    apiKey?: string
  ): Promise<void> {
    const client = this.getClient(apiKey);
    
    const stream = await client.chat.completions.create({
      model: request.model,
      messages: request.messages as any,
      stream: true,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      onChunk({
        content,
        done: false,
      });
    }
    
    onChunk({ done: true });
  }
}
```

### Step 2: Configure Environment Settings
Add support for the default environment key in `server/src/config/index.ts`. 

1. Add your provider key type to the provider configuration interfaces.
2. Load the variable from `process.env` (e.g. `YOURPROVIDER_API_KEY`).

Add your credentials structure to the `.env.example` file:
```bash
# Your Provider
YOURPROVIDER_API_KEY="your-api-key"
```

### Step 3: Register in the Provider Registry
Open `server/src/providers/registry.ts` and import your provider class:

```typescript
import { YourProvider } from './yourprovider.provider';
```

Then register the new instance:
```typescript
providerRegistry.register(new YourProvider());
```

---

## 🔍 Capability Flags & Frontend Toggles

The capabilities dictionary returned inside the model array is parsed by the frontend to dynamically render UI inputs:
- `supportsVision`: When `true`, shows the attachment/image upload paperclip button in the chat input box.
- `supportsThinking`: Enables the Deep Think reasoning switch in the chat input.
- `supportsWebSearch`: Enables the Web Search (Firecrawl) switch.
- `supportsStreaming`: Dictates if client should fall back to non-streaming response modes.
