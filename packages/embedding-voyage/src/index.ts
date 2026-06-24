/**
 * @rag-sdk/embedding-voyage
 * Voyage AI Embedding 适配器
 *
 * 安装: pnpm add @rag-sdk/embedding-voyage
 * 无需额外安装 voyageai SDK，使用原生 fetch 调用 Voyage AI API
 */

import { BaseEmbeddingProvider } from '@rag-sdk/embedding';
import type { EmbeddingConfig } from '@rag-sdk/embedding';

// ==================== API 响应类型 ====================

interface VoyageEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

/** 单次批量请求的最大文本数 */
const MAX_BATCH_SIZE = 128;

// ==================== 适配器实现 ====================

/**
 * Voyage AI Embedding 适配器
 * 使用原生 fetch 调用 Voyage AI Embeddings API
 *
 * 支持的模型：voyage-3-large, voyage-3, voyage-3-lite, voyage-code-3 等
 */
export class VoyageEmbeddingProvider extends BaseEmbeddingProvider {
  readonly dimension: number;
  private readonly model: string;

  constructor(config: EmbeddingConfig & { dimension?: number }) {
    super(config);
    this.model = config.model ?? 'voyage-3';
    // 默认维度根据模型设置
    this.dimension = config.dimension ?? 1024;
  }

  /** Voyage AI API 基础地址 */
  protected override get baseUrl(): string {
    return this.config.baseUrl ?? 'https://api.voyageai.com/v1';
  }

  /** Voyage AI 使用 Bearer Token 认证 */
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
      throw new Error('Voyage AI API returned no embeddings');
    }
    return result;
  }

  /**
   * 批量文本嵌入
   * 单次最多 128 条，超出自动分批请求
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
   * 调用 Voyage AI Embeddings API
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
        `Voyage AI Embedding API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const json = (await response.json()) as VoyageEmbeddingResponse;

    // API 返回的 data 数组按 index 排序，确保顺序与输入一致
    return json.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
