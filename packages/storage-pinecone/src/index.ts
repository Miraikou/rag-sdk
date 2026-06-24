/**
 * @rag-sdk/storage-pinecone
 * Pinecone 向量数据库适配器
 *
 * 安装: pnpm add @rag-sdk/storage-pinecone
 * 无需额外安装 @pinecone-database/pinecone，使用原生 fetch 调用 Pinecone REST API
 */

import { BaseVectorStore } from '@rag-sdk/storage';
import type { Chunk, SearchOptions, SearchResult } from '@rag-sdk/core';

// ==================== API 响应类型 ====================

interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

interface PineconeQueryResponse {
  matches: Array<{
    id: string;
    score: number;
    values?: number[];
    metadata?: Record<string, unknown>;
  }>;
}

interface PineconeFetchResponse {
  vectors: Record<string, PineconeVector>;
}

// ==================== 配置类型 ====================

/** Pinecone 存储配置 */
export interface PineconeConfig {
  apiKey: string;
  /** Pinecone 环境 URL（如 https://my-index-xxx.svc.pinecone.io） */
  baseUrl: string;
  /** 索引名称（用于 /vectors 路径后的操作，Pinecone 服务端已绑定索引） */
  indexHost?: string;
  /** 命名空间 */
  namespace?: string;
}

// ==================== 适配器实现 ====================

/**
 * Pinecone 向量存储适配器
 * 使用原生 fetch 调用 Pinecone REST API
 *
 * 必须提供完整的 Pinecone 索引 URL（如 https://my-index-xxx.svc.pinecone.io）
 */
export class PineconeStore extends BaseVectorStore {
  private config: PineconeConfig;

  constructor(config: PineconeConfig) {
    super();
    this.config = config;
  }

  /** 构建请求头 */
  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Api-Key': this.config.apiKey,
    };
  }

  /** 获取操作的基础 URL */
  private get vectorsUrl(): string {
    return `${this.config.baseUrl}/vectors`;
  }

  /** 获取查询操作的 URL */
  private get queryUrl(): string {
    return `${this.config.baseUrl}/query`;
  }

  /**
   * 插入或更新 chunks
   *
   * @param chunks - 文本块列表
   */
  override async upsert(chunks: Chunk[]): Promise<void> {
    const vectors: PineconeVector[] = chunks
      .filter((c) => c.embedding)
      .map((c) => ({
        id: c.id,
        values: c.embedding!,
        metadata: {
          documentId: c.documentId,
          content: c.content,
          ...c.metadata,
        },
      }));

    if (vectors.length === 0) return;

    const body: Record<string, unknown> = { vectors };
    if (this.config.namespace) {
      body['namespace'] = this.config.namespace;
    }

    const response = await fetch(this.vectorsUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Pinecone API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
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

    const body: Record<string, unknown> = {
      vector: query,
      topK,
      includeMetadata: true,
    };

    if (options?.filter) {
      body['filter'] = options.filter;
    }
    if (this.config.namespace) {
      body['namespace'] = this.config.namespace;
    }

    const response = await fetch(this.queryUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Pinecone API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const json = (await response.json()) as PineconeQueryResponse;
    const threshold = options?.threshold ?? 0;

    return json.matches
      .filter((m) => m.score >= threshold)
      .map((m) => ({
        chunk: {
          id: m.id,
          documentId: (m.metadata?.documentId as string) ?? '',
          content: (m.metadata?.content as string) ?? '',
          metadata: m.metadata ?? {},
          embedding: m.values,
        },
        score: m.score,
        source: 'vector' as const,
      }));
  }

  /**
   * 按 ID 删除 chunks
   *
   * @param ids - chunk ID 列表
   */
  override async delete(ids: string[]): Promise<void> {
    const body: Record<string, unknown> = { ids };
    if (this.config.namespace) {
      body['namespace'] = this.config.namespace;
    }

    const response = await fetch(this.vectorsUrl, {
      method: 'DELETE',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Pinecone API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }

  /**
   * 按文档 ID 删除所有关联 chunks
   * Pinecone 支持按 metadata 过滤删除
   *
   * @param documentId - 文档 ID
   */
  override async deleteByDocument(documentId: string): Promise<void> {
    // Pinecone 通过过滤 metadata 删除
    const url = `${this.config.baseUrl}/vectors/delete`;
    const body: Record<string, unknown> = {
      filter: { documentId: { $eq: documentId } },
    };
    if (this.config.namespace) {
      body['namespace'] = this.config.namespace;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Pinecone API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }
}
