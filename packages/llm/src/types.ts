import type { ChatOptions, Message } from '@rag-sdk/core';

export type { ChatOptions, Message } from '@rag-sdk/core';

/** LLM 提供商配置 */
export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultOptions?: ChatOptions;
}
