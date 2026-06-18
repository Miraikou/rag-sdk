import { BaseEmbeddingProvider } from './base.js';
import type { EmbeddingConfig } from './types.js';

/** OpenAI Embeddings API 响应结构 */
interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/** 单次批量请求的最大文本数 */
const MAX_BATCH_SIZE = 2048;

/**
 * OpenAI Embedding 适配器
 * 使用原生 fetch 调用 OpenAI /embeddings 端点
 */
export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  readonly dimension: number;
  private readonly model: string;

  constructor(config: EmbeddingConfig & { dimension?: number }) {
    super(config);
    this.model = config.model ?? 'text-embedding-3-small';
    this.dimension = config.dimension ?? 1536;
  }

  /** 单条文本嵌入 */
  async embed(text: string): Promise<number[]> {
    const results = await this.requestEmbeddings([text]);
    return results[0]!;
  }

  /**
   * 批量文本嵌入
   * 单次最多 2048 条，超出自动分批请求
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

  /** 调用 OpenAI Embeddings API */
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
        `OpenAI Embedding API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const json = (await response.json()) as OpenAIEmbeddingResponse;

    // API 返回的 data 数组按 index 排序，确保顺序与输入一致
    return json.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
