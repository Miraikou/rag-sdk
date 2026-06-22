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

  /**
   * 结构化输出：返回符合 JSON Schema 的 parsed 对象
   *
   * 默认实现：设置 responseFormat 为 json_schema，调用 chat()，然后 JSON.parse。
   * 子类可覆写以利用 API 原生约束解码能力。
   *
   * @param messages - 对话消息列表
   * @param schema - 标准 JSON Schema 对象
   * @param options - 调用选项
   * @returns 符合 schema 的类型安全对象
   */
  async chatJson<T = unknown>(
    messages: Message[],
    schema: Record<string, unknown>,
    options?: ChatOptions,
  ): Promise<T> {
    const result = await this.chat(messages, {
      ...options,
      responseFormat: {
        type: 'json_schema',
        schema,
        name: 'output',
      },
    });
    return JSON.parse(result) as T;
  }

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
