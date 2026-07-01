/**
 * @ragsdk/embedding-anthropic
 * Anthropic Embedding 适配器
 *
 * 安装: pnpm add @ragsdk/embedding-anthropic
 * 无需额外安装 @anthropic-ai/sdk，使用原生 fetch 调用 API
 *
 * 注意：Anthropic 目前不提供专用 Embedding API，推荐使用 Voyage AI。
 * 此适配器默认使用 OpenAI 兼容的 /embeddings 端点格式，
 * 可通过 baseUrl 配置指向任意兼容服务。
 */

import { BaseEmbeddingProvider } from '@ragsdk/embedding';
import type { EmbeddingConfig } from '@ragsdk/embedding';

// ==================== API 响应类型 ====================

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

/** 单次批量请求的最大文本数 */
const MAX_BATCH_SIZE = 2048;

// ==================== 适配器实现 ====================

/**
 * Anthropic Embedding 适配器
 * 使用原生 fetch 调用 OpenAI 兼容的 Embeddings API
 *
 * 默认使用 OpenAI 兼容格式，可通过 baseUrl 指向 Anthropic 兼容代理或 Voyage AI 等
 * 支持的模型：取决于配置的服务端点
 */
export class AnthropicEmbeddingProvider extends BaseEmbeddingProvider {
  readonly dimension: number;
  private readonly model: string;

  constructor(config: EmbeddingConfig & { dimension?: number }) {
    super(config);
    this.model = config.model ?? 'text-embedding-3-small';
    this.dimension = config.dimension ?? 1536;
  }

  /** API 基础地址，默认使用 OpenAI 兼容端点 */
  protected override get baseUrl(): string {
    return this.config.baseUrl ?? 'https://api.openai.com/v1';
  }

  /** 使用 x-api-key 认证（Anthropic 兼容格式）或 Bearer Token（OpenAI 兼容格式） */
  protected override get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  /**
   * 单条文本嵌入
   *
   * @param text - 输入文本
   * @returns 向量数组
   */
  async embed(text: string): Promise<number[]> {
    const results = await this.requestEmbeddings([text]);
    const result = results[0];
    if (!result) {
      throw new Error('Embedding API returned no embeddings');
    }
    return result;
  }

  /**
   * 批量文本嵌入
   * 单次最多 2048 条，超出自动分批请求
   *
   * @param texts - 输入文本列表
   * @returns 向量数组列表
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const batchResults = await this.requestEmbeddings(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 调用 Embeddings API（OpenAI 兼容格式）
   *
   * @param texts - 输入文本列表
   * @returns 向量数组列表
   */
  private async requestEmbeddings(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/embeddings`;

    const body = JSON.stringify({
      model: this.model,
      input: texts,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Embedding API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const json = (await response.json()) as EmbeddingResponse;

    return json.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
