import type { ChatOptions, LLMProvider, Message } from '@rag-sdk/core';
import type { LLMConfig } from './types';

/** LLM 提供商抽象基类 */
export abstract class BaseLLMProvider implements LLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract chat(messages: Message[], options?: ChatOptions): Promise<string>;
  abstract chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<string>;

  protected mergeOptions(options?: ChatOptions): ChatOptions {
    return { ...this.config.defaultOptions, ...options };
  }

  protected get baseUrl(): string {
    return this.config.baseUrl ?? 'https://api.openai.com/v1';
  }

  protected get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }
}
