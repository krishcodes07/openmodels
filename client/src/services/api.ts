// ============================================
// API Client Service
// ============================================

const API_BASE = '/api';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && this.refreshToken) {
      // Try to refresh the token
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
        });
        if (!retryResponse.ok) {
          throw new Error(await retryResponse.text());
        }
        return retryResponse.json();
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
          this.clearTokens();
        }
        return false;
      }

      const data = await response.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      // Do not clear tokens on network / server down errors
      return false;
    }
  }

  // Auth
  register(email: string, password: string, name?: string) {
    return this.request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  login(email: string, password: string) {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  googleLogin(credential: string) {
    return this.request<any>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }

  getMe() {
    return this.request<any>('/auth/me');
  }

  getAuthConfig() {
    return this.request<any>('/auth/config');
  }

  // Providers
  getProviders() {
    return this.request<any>('/providers');
  }

  getModels(providerId: string) {
    return this.request<any>(`/providers/${providerId}/models`);
  }

  // Conversations
  getConversations() {
    return this.request<any>('/conversations');
  }

  getConversation(id: string) {
    return this.request<any>(`/conversations/${id}`);
  }

  createConversation(data: { title?: string; providerId?: string; modelId?: string; personaId?: string }) {
    return this.request<any>('/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateConversation(id: string, data: { title?: string; providerId?: string; modelId?: string; isPinned?: boolean }) {
    return this.request<any>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  deleteConversation(id: string) {
    return this.request<any>(`/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  // Personas
  getPersonas() {
    return this.request<any>('/personas');
  }

  createPersona(data: { name: string; description: string; systemPrompt: string; imageUrl?: string }) {
    return this.request<any>('/personas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deletePersona(id: string) {
    return this.request<any>(`/personas/${id}`, {
      method: 'DELETE',
    });
  }

  // Chat (SSE streaming)
  async streamChat(
    data: {
      conversationId?: string;
      message: string;
      providerId: string;
      modelId: string;
      thinking?: boolean;
      webSearch?: boolean;
      imageUrls?: string[];
      personaId?: string;
      messages?: { role: string; content: string; imageUrls?: string[] }[];
    },
    onEvent: (event: any) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(data),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Chat failed' }));
      throw new Error(error.error || 'Chat failed');
    }

    // Extract the real conversation ID from the response header immediately
    const headerConvId = response.headers.get('X-Conversation-Id');
    if (headerConvId) {
      onEvent({ type: 'conversationId', conversationId: headerConvId });
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }

  async streamRegenerate(
    data: {
      conversationId: string;
      messageId: string;
      providerId: string;
      modelId: string;
      thinking?: boolean;
      webSearch?: boolean;
    },
    onEvent: (event: any) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/chat/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(data),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Regeneration failed' }));
      throw new Error(error.error || 'Regeneration failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }

  async streamEdit(
    data: {
      conversationId: string;
      messageId: string;
      content: string;
      providerId: string;
      modelId: string;
      thinking?: boolean;
      webSearch?: boolean;
    },
    onEvent: (event: any) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/chat/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(data),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Edit failed' }));
      throw new Error(error.error || 'Edit failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response body');

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }

  // Settings
  getSettings() {
    return this.request<any>('/settings');
  }

  updateSettings(data: any) {
    return this.request<any>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  getUsageStats() {
    return this.request<any>('/settings/usage');
  }

  getApiKeys() {
    return this.request<any>('/settings/api-keys');
  }

  saveApiKey(providerId: string, apiKey: string) {
    return this.request<any>(`/settings/api-keys/${providerId}`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    });
  }

  deleteApiKey(providerId: string) {
    return this.request<any>(`/settings/api-keys/${providerId}`, {
      method: 'DELETE',
    });
  }

  async uploadFiles(files: File[]): Promise<{ urls: string[] }> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE}/chat/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }
}

export const api = new ApiClient();
