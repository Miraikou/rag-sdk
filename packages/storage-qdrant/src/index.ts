/**
 * @rag-sdk/storage-qdrant
 * Qdrant 向量数据库适配器
 *
 * 安装: pnpm add @rag-sdk/storage-qdrant
 * 无需额外安装 @qdrant/js-client-rest，使用原生 fetch 调用 Qdrant REST API
 */

import { BaseVectorStore } from '@rag-sdk/storage';
import type { Chunk, SearchOptions, SearchResult } from '@rag-sdk/core';

// ==================== API 响应类型 ====================

interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

interface QdrantSearchResult {
  id: string | number;
  score: number;
  version: number;
  vector?: number[];
  payload?: Record<string, unknown>;
}

interface QdrantScrollResponse {
  result: {
    points: QdrantPoint[];
    next_page_offset: string | number | null;
  };
}

// ==================== 配置类型 ====================

/** Qdrant 存储配置 */
export interface QdrantConfig {
  /** Qdrant 服务 URL（如 http://localhost:6333） */
  baseUrl: string;
  /** API Key（Qdrant Cloud 需要） */
  apiKey?: string;
  /** 集合名称（默认 "rag_chunks"） */
  collectionName?: string;
  /** 向量维度 */
  dimension?: number;
}

// ==================== 适配器实现 ====================

/**
 * Qdrant 向量存储适配器
 * 使用原生 fetch 调用 Qdrant REST API
 */
export class QdrantStore extends BaseVectorStore {
  private config: QdrantConfig;
  private collectionName: string;

  constructor(config: QdrantConfig) {
    super();
    this.config = config;
    this.collectionName = config.collectionName ?? 'rag_chunks';
  }

  /** 构建请求头 */
  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['api-key'] = this.config.apiKey;
    }
    return headers;
  }

  /** 获取集合的基础路径 */
  private get collectionPath(): string {
    return `${this.config.baseUrl}/collections/${this.collectionName}`;
  }

  /**
   * 确保集合存在，不存在则创建
   *
   * @param dimension - 向量维度
   */
  private async ensureCollection(dimension: number): Promise<void> {
    const response = await fetch(this.collectionPath, {
      method: 'GET',
      headers: this.headers,
    });

    if (response.ok) return;

    // 创建集合
    const createResponse = await fetch(
      `${this.config.baseUrl}/collections/${this.collectionName}`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          vectors: {
            size: dimension,
            distance: 'Cosine',
          },
        }),
      },
    );

    if (!createResponse.ok && createResponse.status !== 409) {
      const errorText = await createResponse.text();
      throw new Error(
        `Qdrant API 创建集合失败: ${createResponse.status} - ${errorText}`,
      );
    }
  }

  /**
   * 插入或更新 chunks
   *
   * @param chunks - 文本块列表
   */
  override async upsert(chunks: Chunk[]): Promise<void> {
    const validChunks = chunks.filter((c) => c.embedding);
    if (validChunks.length === 0) return;

    const dimension = validChunks[0]!.embedding!.length;
    await this.ensureCollection(dimension);

    const points: QdrantPoint[] = validChunks.map((c) => ({
      id: c.id,
      vector: c.embedding!,
      payload: {
        documentId: c.documentId,
        content: c.content,
        ...c.metadata,
      },
    }));

    const response = await fetch(`${this.collectionPath}/points?wait=true`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ points }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Qdrant API 请求失败: ${response.status} - ${errorText}`,
      );
    }
  }

  /**
   * 按文档 ID 替换所有 chunks
   *
   * @param documentId - 文档 ID
   * @param chunks - 文本块列表
   */
  override async upsertByDocument(documentId: string, chunks: Chunk[]): Promise<void> {
    await this.deleteByDocument(documentId);
    await this.upsert(chunks);
  }

  /**
   * 向量搜索
   *
   * @param query - 查询向量
   * @param options - 搜索选项
   * @returns 搜索结果列表
   */
  override async search(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0;

    const body: Record<string, unknown> = {
      vector: query,
      limit: topK,
      with_payload: true,
      with_vector: true,
      score_threshold: threshold,
    };

    if (options?.filter) {
      body['filter'] = {
        must: Object.entries(options.filter).map(([key, value]) => ({
          key,
          match: { value },
        })),
      };
    }

    const response = await fetch(`${this.collectionPath}/points/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // 集合可能不存在
      if (response.status === 404) return [];
      const errorText = await response.text();
      throw new Error(
        `Qdrant API 请求失败: ${response.status} - ${errorText}`,
      );
    }

    const json = (await response.json()) as { result?: QdrantSearchResult[] };
    const results: QdrantSearchResult[] = json.result ?? [];

    return results.map((r) => ({
      chunk: {
        id: String(r.id),
        documentId: (r.payload?.documentId as string) ?? '',
        content: (r.payload?.content as string) ?? '',
        metadata: r.payload ?? {},
        embedding: r.vector,
      },
      score: r.score,
      source: 'vector' as const,
    }));
  }

  /**
   * 按 ID 删除 chunks
   *
   * @param ids - chunk ID 列表
   */
  override async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    // Qdrant 按 ID 删除点
    const points = ids.map((id) => ({ id }));
    const response = await fetch(`${this.collectionPath}/points/delete?wait=true`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ points }),
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(
        `Qdrant API 请求失败: ${response.status} - ${errorText}`,
      );
    }
  }

  /**
   * 按文档 ID 删除所有关联 chunks
   * Qdrant 使用 scroll API 查找后批量删除
   *
   * @param documentId - 文档 ID
   */
  override async deleteByDocument(documentId: string): Promise<void> {
    // 先 scroll 查找匹配的点
    const scrollResponse = await fetch(`${this.collectionPath}/points/scroll`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        filter: {
          must: [{ key: 'documentId', match: { value: documentId } }],
        },
        limit: 1000,
        with_payload: false,
        with_vector: false,
      }),
    });

    if (!scrollResponse.ok) {
      if (scrollResponse.status === 404) return;
      const errorText = await scrollResponse.text();
      throw new Error(
        `Qdrant API 请求失败: ${scrollResponse.status} - ${errorText}`,
      );
    }

    const scrollJson = (await scrollResponse.json()) as QdrantScrollResponse;
    const points = scrollJson.result.points;
    if (points.length === 0) return;

    const ids = points.map((p) => p.id);
    await this.delete(ids.map(String));
  }
}
