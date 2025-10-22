// Ollama Models
export type OllamaModelId = string;
export const ollamaDefaultModelId: OllamaModelId = "";
// Generic model info for Ollama (used only for pricing display)
export const ollamaModels = {
  "ollama": {
    name: "Ollama",
    inputPrice: 0.0,
    outputPrice: 0.0,
    maxTokens: 4096,
    contextWindow: 32768,
    supportsImages: false,
    supportsPromptCache: false,
  }
};

// Anthropic Models
export type AnthropicModelId = keyof typeof anthropicModels;
export const anthropicDefaultModelId: AnthropicModelId = "claude-sonnet-4-5-20250929";
export const anthropicModels = {
  // Claude 4.5 Models (Latest)
  "claude-sonnet-4-5-20250929": {
    name: "Claude 4.5 Sonnet",
    inputPrice: 3.0,
    outputPrice: 15.0,
    maxTokens: 64000,
    contextWindow: 200000, // 1M with beta header
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 3.75, // 1.25x input price
    cacheReadsPrice: 0.3, // 0.1x input price
  },
  "claude-haiku-4-5-20251001": {
    name: "Claude 4.5 Haiku",
    inputPrice: 1.0,
    outputPrice: 5.0,
    maxTokens: 64000,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 1.25, // 1.25x input price
    cacheReadsPrice: 0.1, // 0.1x input price
  },
  "claude-opus-4-1-20250805": {
    name: "Claude 4.1 Opus",
    inputPrice: 15.0,
    outputPrice: 75.0,
    maxTokens: 32000,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 18.75, // 1.25x input price
    cacheReadsPrice: 1.5, // 0.1x input price
  },
  // Claude 4 Models
  "claude-opus-4-20250514": {
    name: "Claude 4 Opus",
    inputPrice: 15.0,
    outputPrice: 75.0,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 18.75, // 5m cache writes
    cacheReadsPrice: 1.5,
  },
  "claude-sonnet-4-20250514": {
    name: "Claude 4 Sonnet",
    inputPrice: 3.0,
    outputPrice: 15.0,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 3.75, // 5m cache writes
    cacheReadsPrice: 0.3,
  },
  // Claude 3.7 Models
  "claude-3-7-sonnet-20250219": {
    name: "Claude 3.7 Sonnet",
    inputPrice: 3.0,
    outputPrice: 15.0,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 3.75, // 5m cache writes
    cacheReadsPrice: 0.3,
  },
  // Claude 3.5 Models
  "claude-3-5-sonnet-20241022": {
    name: "Claude 3.5 Sonnet",
    inputPrice: 3.0,
    outputPrice: 15.0,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 3.75, // 5m cache writes
    cacheReadsPrice: 0.3,
  },
  "claude-3-5-haiku-20241022": {
    name: "Claude 3.5 Haiku",
    inputPrice: 0.8,
    outputPrice: 4.0,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 1.0, // 5m cache writes
    cacheReadsPrice: 0.08,
  },
  // Claude 3 Models
  "claude-3-opus-20240229": {
    name: "Claude 3 Opus",
    inputPrice: 15.0,
    outputPrice: 75.0,
    maxTokens: 4096,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 18.75, // 5m cache writes
    cacheReadsPrice: 1.5,
  },
  "claude-3-haiku-20240307": {
    name: "Claude 3 Haiku",
    inputPrice: 0.25,
    outputPrice: 1.25,
    maxTokens: 4096,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheWritesPrice: 0.3, // 5m cache writes
    cacheReadsPrice: 0.03,
  },
};

// OpenAI Models
export type OpenAIModelId = keyof typeof openaiModels;
export const openaiDefaultModelId: OpenAIModelId = "gpt-4o";
export const openaiModels = {
  // GPT-5 Models (newest first)
  "gpt-5": {
    name: "GPT-5",
    inputPrice: 1.25,
    outputPrice: 10.0,
    maxTokens: 128000,
    contextWindow: 400000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheReadsPrice: 0.125,
    isReasoningModel: true,
  },
  "gpt-5-mini": {
    name: "GPT-5 Mini",
    inputPrice: 0.25,
    outputPrice: 2.0,
    maxTokens: 128000,
    contextWindow: 400000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheReadsPrice: 0.025,
    isReasoningModel: true,
  },
  "gpt-5-nano": {
    name: "GPT-5 Nano",
    inputPrice: 0.05,
    outputPrice: 0.40,
    maxTokens: 128000,
    contextWindow: 400000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheReadsPrice: 0.005,
    isReasoningModel: true,
  },
  // Existing OpenAI Models
  "gpt-4o": {
    name: "GPT-4o",
    inputPrice: 2.5,
    outputPrice: 10.0,
    maxTokens: 4096,
    contextWindow: 128000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheReadsPrice: 1.25,
  },
  "o3": {
    name: "o3",
    inputPrice: 2.0,
    outputPrice: 8.0,
    maxTokens: 100000,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheReadsPrice: 0.5,
  },
  "o4-mini": {
    name: "o4-mini",
    inputPrice: 1.1,
    outputPrice: 4.4,
    maxTokens: 100000,
    contextWindow: 200000,
    supportsImages: true,
    supportsPromptCache: true,
    cacheReadsPrice: 0.275,
  },
};

// Gemini Models
export type GeminiModelId = keyof typeof geminiModels;
export const geminiDefaultModelId: GeminiModelId = "gemini-2.5-flash-preview-05-20";
export const geminiModels = {
  "gemini-2.5-flash-preview-05-20": {
    name: "Gemini 2.5 Flash",
    inputPrice: 0.15,
    outputPrice: 0.6,
    maxTokens: 65536,
    contextWindow: 1048576,
    supportsImages: true,
    supportsPromptCache: true,
    thinkingConfig: {
      maxBudget: 24576,
      outputPrice: 3.5,
    },
  },
  "gemini-2.5-pro-preview-05-06": {
    name: "Gemini 2.5 Pro",
    inputPrice: 1.25,
    outputPrice: 10.0,
    maxTokens: 65536,
    contextWindow: 1048576,
    supportsImages: true,
    supportsPromptCache: true,
  },
  "gemini-2.0-flash-001": {
    name: "Gemini 2.0 Flash",
    inputPrice: 0.1,
    outputPrice: 0.4,
    maxTokens: 8192,
    contextWindow: 1048576,
    supportsImages: true,
    supportsPromptCache: false,
  },
  "gemini-2.0-flash-lite-preview-02-05": {
    name: "Gemini 2.0 Flash Lite",
    inputPrice: 0.075,
    outputPrice: 0.30,
    maxTokens: 8192,
    contextWindow: 1048576,
    supportsImages: true,
    supportsPromptCache: false,
  },
};
