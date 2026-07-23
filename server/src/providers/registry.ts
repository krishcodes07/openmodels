// ============================================
// Provider Registry
// ============================================
// Central registry for all AI providers.
// Allows dynamic registration of provider instances or constructors.

import { BaseProvider, ProviderInfo } from './base.provider';
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
import { AgnesProvider } from './agnes.provider';

export type ProviderInput = BaseProvider | (new () => BaseProvider);

/**
 * Default list of built-in providers registered on startup.
 */
export const ALL_PROVIDERS: ProviderInput[] = [
  NvidiaProvider,
  GroqProvider,
  OpenRouterProvider,
  GeminiProvider,
  MistralProvider,
  GithubModelsProvider,
  CerebrasProvider,
  SambanovaProvider,
  HuggingFaceProvider,
  OpenCodeProvider,
  CohereProvider,
  CloudflareProvider,
  ZaiProvider,
  AgnesProvider,
];

export class ProviderRegistry {
  private providers = new Map<string, BaseProvider>();

  /**
   * Register a provider instance or constructor.
   */
  register(providerInput: ProviderInput): BaseProvider {
    const provider = typeof providerInput === 'function' ? new providerInput() : providerInput;
    this.providers.set(provider.info.id, provider);
    console.log(`[Registry] Registered provider: ${provider.info.name} (${provider.info.id})`);
    return provider;
  }

  /**
   * Register multiple providers (instances or constructors) at once.
   */
  registerAll(providerInputs: ProviderInput[]): void {
    for (const input of providerInputs) {
      this.register(input);
    }
  }

  get(id: string): BaseProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  getAllInfo(): ProviderInfo[] {
    return this.getAll().map(p => p.info);
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  clear(): void {
    this.providers.clear();
  }
}

// Singleton instance auto-populated with built-in providers
export const providerRegistry = new ProviderRegistry();
providerRegistry.registerAll(ALL_PROVIDERS);
