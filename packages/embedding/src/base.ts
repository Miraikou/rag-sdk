import type { EmbeddingProvider } from '@ragsdk/core';
import type { EmbeddingConfig } from './types.js';

/**
 * Embedding 提供商抽象基类
 * 封装通用配置与请求头构建逻辑，子类只需实现 embed / embedBatch
 */
export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  protected config: EmbeddingConfig;

  abstract readonly dimension: number;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  abstract embed(text: string): Promise<number[]>;
  abstract embedBatch(texts: string[]): Promise<number[][]>;

  /** API 基础地址，默认 OpenAI 官方端点 */
  protected get baseUrl(): string {
    return this.config.baseUrl ?? 'https://api.openai.com/v1';
  }

  /** 构建请求头（Content-Type + Bearer Token） */
  protected get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }
}
