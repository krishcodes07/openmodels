// ============================================
// Provider Registry
// ============================================
// Central registry for all AI providers.
// Adding a new provider = import + register. That's it.

import { BaseProvider } from './base.provider';
import { NvidiaProvider } from './nvidia.provider';
import { GroqProvider } from './groq.provider';
import { OpenRouterProvider } from './openrouter.provider';
import { GeminiProvider } from './gemini.provider';
import { MistralProvider } from './mistral.provider';
import { GithubModelsProvider } from './github.provider';
import { CerebrasProvider } from './cerebras.provider';
import { SambanovaProvider } from './sambanova.provider';
import { HuggingFaceProvider } from './huggingface.provider';
import { OpenCodeProvider } from './opencode.provider';
import { CohereProvider } from './cohere.provider';
import { CloudflareProvider } from './cloudflare.provider';
import { ZaiProvider } from './zai.provider';

class ProviderRegistry {
  private providers = new Map<string, BaseProvider>();

  register(provider: BaseProvider): void {
    this.providers.set(provider.info.id, provider);
    console.log(`[Registry] Registered provider: ${provider.info.name}`);
  }

  get(id: string): BaseProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  getAllInfo() {
    return this.getAll().map(p => p.info);
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();

// Register all providers
providerRegistry.register(new NvidiaProvider());
providerRegistry.register(new GroqProvider());
providerRegistry.register(new OpenRouterProvider());
providerRegistry.register(new GeminiProvider());
providerRegistry.register(new MistralProvider());
providerRegistry.register(new GithubModelsProvider());
providerRegistry.register(new CerebrasProvider());
providerRegistry.register(new SambanovaProvider());
providerRegistry.register(new HuggingFaceProvider());

providerRegistry.register(new OpenCodeProvider());
providerRegistry.register(new CohereProvider());
providerRegistry.register(new CloudflareProvider());
providerRegistry.register(new ZaiProvider());

