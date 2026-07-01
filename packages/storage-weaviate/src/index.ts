/**
 * @ragsdk/storage-weaviate
 * Weaviate 向量数据库适配器
 *
 * 安装: pnpm add @ragsdk/storage-weaviate
 * 无需额外安装 weaviate-ts-client，使用原生 fetch 调用 Weaviate REST API
 */

import { BaseVectorStore } from '@ragsdk/storage';
import type { Chunk, SearchOptions, SearchResult } from '@ragsdk/core';

// ==================== API 响应类型 ====================

interface WeaviateObject {
  id: string;
  class: string;
  properties: Record<string, unknown>;
  vector: number[];
}

interface WeaviateGetResponse {
  objects: WeaviateObject[];
}

// ==================== 配置类型 ====================

/** Weaviate 存储配置 */
export interface WeaviateConfig {
  /** Weaviate 实例 URL（如 https://localhost:8080） */
  baseUrl: string;
  /** API Key（可选，Weaviate Cloud 需要） */
  apiKey?: string;
  /** 集合/类名称（默认 "Chunk"） */
  className?: string;
}

// ==================== 适配器实现 ====================

/**
 * Weaviate 向量存储适配器
 * 使用原生 fetch 调用 Weaviate REST + GraphQL API
 */
export class WeaviateStore extends BaseVectorStore {
  private config: WeaviateConfig;
  private className: string;

  constructor(config: WeaviateConfig) {
    super();
    this.config = config;
    this.className = config.className ?? 'Chunk';
  }

  /** 构建请求头 */
  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  /**
   * 插入或更新 chunks
   *
   * @param chunks - 文本块列表
   */
  override async upsert(chunks: Chunk[]): Promise<void> {
    const objects = chunks
      .filter((c) => c.embedding)
      .map((c) => ({
        id: c.id,
        class: this.className,
        properties: {
          documentId: c.documentId,
          content: c.content,
          ...c.metadata,
        },
        vector: c.embedding,
      }));

    if (objects.length === 0) return;

    // Weaviate batch API：POST /v1/batch/objects
    const response = await fetch(`${this.config.baseUrl}/v1/batch/objects`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ objects }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Weaviate API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
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
   * 使用 Weaviate GraphQL API（POST /v1/graphql）
   *
   * @param query - 查询向量
   * @param options - 搜索选项
   * @returns 搜索结果列表
   */
  override async search(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0;

    // 构建 nearVector GraphQL 查询
    const filterClause = options?.filter
      ? `where: { operator: And, operands: [${Object.entries(options.filter)
          .map(([key, value]) => `{ path: ["${key}"], operator: Equal, valueString: "${String(value)}" }`)
          .join(', ')}] }`
      : '';

    const graphqlQuery = `
      {
        Get {
          ${this.className}(
            nearVector: {
              vector: [${query.join(', ')}]
            }
            limit: ${topK}
            ${filterClause}
          ) {
            documentId
            content
            _additional {
              id
              distance
              vector
            }
          }
        }
      }
    `;

    const response = await fetch(`${this.config.baseUrl}/v1/graphql`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query: graphqlQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Weaviate API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const json = (await response.json()) as {
      data?: { Get?: Record<string, Array<{
        documentId: string;
        content: string;
        _additional: { id: string; distance: number; vector: number[] };
      }>> };
    };
    const objects = json?.data?.Get?.[this.className] ?? [];

    return objects
      .filter((obj) => obj._additional.distance >= threshold)
      .map((obj) => ({
        chunk: {
          id: obj._additional.id,
          documentId: obj.documentId,
          content: obj.content,
          metadata: {},
          embedding: obj._additional.vector,
        },
        // Weaviate 返回 distance（越小越相似），转换为 score（越大越相似）
        score: 1 - obj._additional.distance,
        source: 'vector' as const,
      }));
  }

  /**
   * 按 ID 删除 chunks
   *
   * @param ids - chunk ID 列表
   */
  override async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      const response = await fetch(
        `${this.config.baseUrl}/v1/objects/${this.className}/${id}`,
        {
          method: 'DELETE',
          headers: this.headers,
        },
      );

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        throw new Error(
          `Weaviate API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }
    }
  }

  /**
   * 按文档 ID 删除所有关联 chunks
   *
   * @param documentId - 文档 ID
   */
  override async deleteByDocument(documentId: string): Promise<void> {
    // 使用 batch delete 按属性过滤删除
    const response = await fetch(`${this.config.baseUrl}/v1/batch/objects`, {
      method: 'DELETE',
      headers: this.headers,
      body: JSON.stringify({
        match: {
          class: this.className,
          where: {
            operator: 'Equal',
            path: ['documentId'],
            valueString: documentId,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Weaviate API 请求失败: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  }
}
