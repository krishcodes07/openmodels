import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const rootEnv = path.resolve(__dirname, '../../../.env');
const serverEnv = path.resolve(__dirname, '../../.env');

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config({ path: serverEnv });
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-bytes-long!',
  },

  providers: {
    nvidia: {
      apiKey: process.env.NVIDIA_API_KEY || '',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      baseUrl: 'https://api.groq.com/openai/v1',
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseUrl: 'https://openrouter.ai/api/v1',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    },
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY || '',
      baseUrl: 'https://api.mistral.ai/v1',
    },
    github: {
      apiKey: process.env.GITHUB_API_KEY || '',
      baseUrl: "https://models.github.ai/inference"
    },
    cerebras: {
      apiKey: process.env.CEREBRAS_API_KEY || '',
      baseUrl: 'https://api.cerebras.ai/v1',
    },
    sambanova: {
      apiKey: process.env.SAMBANOVA_API_KEY || '',
      baseUrl: 'https://api.sambanova.ai/v1',
    },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || '',
      baseUrl: 'https://router.huggingface.co/v1',
    },
    opencode: {
      apiKey: process.env.OPENCODE_API_KEY || '',
      baseUrl: 'https://opencode.ai/zen/v1',
    },
    cohere: {
      apiKey: process.env.COHERE_API_KEY || '',
      baseUrl: 'https://api.cohere.ai/compatibility/v1',
    },
    cloudflare: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
      apiKey: process.env.CLOUDFLARE_API_TOKEN || '',
      baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    },
    zai: {
      apiKey: process.env.ZAI_API_KEY || '',
      baseUrl: 'https://api.z.ai/api/paas/v4',
    },
  },

  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY || '',
  },
} as const;
