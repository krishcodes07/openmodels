# Deep Think Toggle and Nvidia NIM Thinking Models Support

## 1. Problem Context
NVIDIA NIM and other modern providers (like Groq and OpenRouter) host reasoning models (such as `z-ai/glm-5.2` and `deepseek-ai/deepseek-r1`). These models require specific configurations to control their reasoning behavior:
- On NVIDIA NIM, the thinking mode is configured dynamically by passing `extra_body: { chat_template_kwargs: { enable_thinking: boolean, clear_thinking: false } }` to the chat completion API.
- Furthermore, reasoning tokens are streamed in specific non-standard JSON properties: `delta.reasoning_content` or `delta.thinking`.

Previously, the "Deep Think" toggle option was not visible for models like `z-ai/glm-5.2` because they were not dynamically tagged with the `supportsThinking` capability. Additionally, their reasoning tokens were not parsed or displayed during streaming.

---

## 2. Solutions Implemented

### A. Dynamic Model Capabilities (Nvidia NIM)
In `NvidiaProvider.listModels`, we updated the capability detection to correctly mark models containing GLM (e.g. `glm-5`, `glm-4.7`, `glm-4.6`, `glm-4.5`, etc.) as supporting thinking:
```typescript
const idLower = m.id.toLowerCase();
const supportsThinking = idLower.includes('r1') || 
                         idLower.includes('reasoning') || 
                         idLower.includes('think') || 
                         idLower.includes('glm-5') || 
                         idLower.includes('glm-4.7') || 
                         idLower.includes('glm-4.6') || 
                         idLower.includes('glm-4.5') || 
                         idLower.includes('glm-4');
```

### B. Dynamically Passing Thinking Parameters to Nvidia NIM
In `NvidiaProvider.chat` and `NvidiaProvider.streamChat`, we check if the model supports thinking and if so, append `extra_body` based on the user's toggle state:
```typescript
if (modelSupportsThinking) {
  completionParams.extra_body = {
    chat_template_kwargs: {
      enable_thinking: request.thinking !== false,
      clear_thinking: false
    }
  };
}
```

### C. Live Parsing and Streaming of Reasoning Tokens
We unified token capture across the three primary providers hosting reasoning models (`NvidiaProvider`, `GroqProvider`, and `OpenrouterProvider`). In their respective stream loops, the delta block now checks for and forwards `reasoning_content` and `thinking` properties:
```typescript
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  if (delta) {
    if (delta.content) {
      onChunk({ content: delta.content, done: false });
    }
    if ((delta as any).reasoning_content) {
      onChunk({ thinkingContent: (delta as any).reasoning_content, done: false });
    }
    if ((delta as any).thinking) {
      onChunk({ thinkingContent: (delta as any).thinking, done: false });
    }
  }
}
```
This ensures the live "thinking bubble" displays in the client interface when these models process inputs.

---

## 3. UI Toggle Configuration
The frontend automatically exposes the **Deep Think** toggle button in the input toolbar next to the send button when:
1. `capabilities.supportsThinking` is `true` for the selected model.
2. The model is not an "always-on" reasoning model like DeepSeek R1 (i.e. model ID does not contain `r1` or `deepseek` since these models cannot have thinking turned off).

With the dynamic capability updates on the backend, models like `z-ai/glm-5.2` now display this toggle correctly, sending the appropriate toggle parameter to the backend to enable or disable deep thinking.
