/**
 * @ragsdk/storage-chroma
 * Chroma 向量数据库适配器
 *
 * 安装: pnpm add @ragsdk/storage-chroma
 * 无需额外安装 chromadb，使用原生 fetch 调用 Chroma REST API
 */

import { BaseVectorStore } from '@ragsdk/storage';
import type { Chunk, SearchOptions, SearchResult } from '@ragsdk/core';

// ==================== API 响应类型 ====================

interface ChromaCollection {
  id: string;
  name: string;
}

interface ChromaQueryResult {
  ids: string[][];
  embeddings: number[][][] | null;
  documents: string[][];
  metadatas: Array<Array<Record<string, unknown>>> | null;
  distances: number[][];
}

// ==================== 配置类型 ====================

/** Chroma 存储配置 */
export interface ChromaConfig {
  /** Chroma 服务 URL（如 http://localhost:8000） */
  baseUrl: string;
  /** 租户 ID（默认 "default_tenant"） */
  tenant?: string;
  /** 数据库名（默认 "default_database"） */
  database?: string;
  /** 集合名称（默认 "rag_chunks"） */
  collectionName?: string;
}

// ==================== 适配器实现 ====================

/**
 * Chroma 向量存储适配器
 * 使用原生 fetch 调用 Chroma REST API
 */
export class ChromaStore extends BaseVectorStore {
  private config: ChromaConfig;
  private collectionName: string;
  private tenant: string;
  private database: string;
  private collectionId: string | null = null;

  constructor(config: ChromaConfig) {
    super();
    this.config = config;
    this.collectionName = config.collectionName ?? 'rag_chunks';
    this.tenant = config.tenant ?? 'default_tenant';
    this.database = config.database ?? 'default_database';
  }

  /** 构建请求头 */
  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  /** 获取集合的基础路径 */
  private get collectionPath(): string {
    return `${this.config.baseUrl}/api/v2/${this.tenant}/${this.database}/collections/${this.collectionName}`;
  }

  /**
   * 确保集合存在，获取或创建 collection ID
   */
  private async ensureCollection(dimension: number): Promise<void> {
    if (this.collectionId) return;

    // 尝试获取现有集合
    const getResponse = await fetch(this.collectionPath, {
      method: 'GET',
      headers: this.headers,
    });

    if (getResponse.ok) {
      const col = (await getResponse.json()) as ChromaCollection;
      this.collectionId = col.id;
      return;
    }

    // 创建集合
    const createResponse = await fetch(
      `${this.config.baseUrl}/api/v2/${this.tenant}/${this.database}/collections`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          name: this.collectionName,
          dimension,
        }),
      },
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(
        `Chroma API 创建集合失败: ${createResponse.status} - ${errorText}`,
      );
    }

    const col = (await createResponse.json()) as ChromaCollection;
    this.collectionId = col.id;
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

    const ids: string[] = [];
    const embeddings: number[][] = [];
    const documents: string[] = [];
    const metadatas: Array<Record<string, unknown>> = [];

    for (const c of validChunks) {
      ids.push(c.id);
      embeddings.push(c.embedding!);
      documents.push(c.content);
      metadatas.push({
        documentId: c.documentId,
        ...c.metadata,
      });
    }

    const response = await fetch(`${this.collectionPath}/upsert`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ ids, embeddings, documents, metadatas }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Chroma API 请求失败: ${response.status} - ${errorText}`,
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

    // 确保集合存在（仅用于确保初始化）
    await this.ensureCollection(query.length);

    const body: Record<string, unknown> = {
      query_embeddings: [query],
      n_results: topK,
      include: ['documents', 'metadatas', 'embeddings', 'distances'],
    };

    if (options?.filter) {
      body['where_document'] = { $and: Object.entries(options.filter).map(
        ([key, value]) => ({ [key]: value }),
      ) };
    }

    const response = await fetch(`${this.collectionPath}/query`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Chroma API 请求失败: ${response.status} - ${errorText}`,
      );
    }

    const json = (await response.json()) as ChromaQueryResult;
    const ids = json.ids[0] ?? [];
    const embeddings = json.embeddings?.[0] ?? [];
    const documents = json.documents[0] ?? [];
    const metadatas = json.metadatas?.[0] ?? [];
    const distances = json.distances[0] ?? [];

    const results: SearchResult[] = [];
    for (let i = 0; i < ids.length; i++) {
      // Chroma 返回距离（越小越相似），转换为相似度分数
      const distance = distances[i] ?? 0;
      const score = 1 / (1 + distance);

      if (score < threshold) continue;

      const id = ids[i]!;
      results.push({
        chunk: {
          id,
          documentId: (metadatas[i]?.documentId as string) ?? '',
          content: documents[i] ?? '',
          metadata: metadatas[i] ?? {},
          embedding: embeddings[i] ?? undefined,
        },
        score,
        source: 'vector',
      });
    }

    return results;
  }

  /**
   * 按 ID 删除 chunks
   *
   * @param ids - chunk ID 列表
   */
  override async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const response = await fetch(`${this.collectionPath}/delete`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ ids }),
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(
        `Chroma API 请求失败: ${response.status} - ${errorText}`,
      );
    }
  }

  /**
   * 按文档 ID 删除所有关联 chunks
   *
   * @param documentId - 文档 ID
   */
  override async deleteByDocument(documentId: string): Promise<void> {
    const response = await fetch(`${this.collectionPath}/delete`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        where: { documentId },
      }),
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(
        `Chroma API 请求失败: ${response.status} - ${errorText}`,
      );
    }
  }
}
