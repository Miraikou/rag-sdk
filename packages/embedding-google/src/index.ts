/**
 * @ragsdk/embedding-google
 * Google Embedding 适配器
 *
 * 安装: pnpm add @ragsdk/embedding-google
 * 无需额外安装 @google/generative-ai，使用原生 fetch 调用 Gemini API
 */

import { BaseEmbeddingProvider } from '@ragsdk/embedding';
import type { EmbeddingConfig } from '@ragsdk/embedding';

// ==================== API 响应类型 ====================

interface GoogleEmbeddingResponse {
  embeddings: Array<{
    values: number[];
  }>;
}

/** 单次批量请求的最大文本数 */
const MAX_BATCH_SIZE = 100;

// ==================== 适配器实现 ====================

/**
 * Google Embedding 适配器
 * 使用原生 fetch 调用 Gemini Embedding API
 *
 * 支持的模型：text-embedding-004, embedding-001 等
 * 默认维度：text-embedding-004 为 768
 */
export class GoogleEmbeddingProvider extends BaseEmbeddingProvider {
  readonly dimension: number;
  private readonly model: string;

  constructor(config: EmbeddingConfig & { dimension?: number }) {
    super(config);
    this.model = config.model ?? 'text-embedding-004';
    this.dimension = config.dimension ?? 768;
  }

  /** Gemini API 基础地址 */
  protected override get baseUrl(): string {
    return this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * 单条文本嵌入
   *
   * @param text - 输入文本
   * @returns 向量数组
   */
  async embed(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/models/${this.model}:embedContent?key=${this.config.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Embedding API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const json = (await response.json()) as GoogleEmbeddingResponse;
    const embedding = json.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error('Google Embedding API returned no embedding');
    }
    return embedding;
  }

  /**
   * 批量文本嵌入
   * 注意：Gemini embedContent 仅支持单条，批量使用 batchEmbedContents
   *
   * @param texts - 输入文本列表
   * @returns 向量数组列表
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    // Gemini 的 batchEmbedContents 支持最多 100 条
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const url = `${this.baseUrl}/models/${this.model}:batchEmbedContents?key=${this.config.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
          })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google Embedding API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const json = (await response.json()) as GoogleEmbeddingResponse;
      const batchResults = (json.embeddings ?? []).map((item) => item.values);
      results.push(...batchResults);
    }

    return results;
  }
}
