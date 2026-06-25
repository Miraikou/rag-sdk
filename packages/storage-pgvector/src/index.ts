/**
 * @rag-sdk/storage-pgvector
 * PostgreSQL + pgvector 向量数据库适配器
 *
 * 安装:
 *   pnpm add @rag-sdk/storage-pgvector pg
 *
 * 前置条件:
 *   1. PostgreSQL 已安装并运行
 *   2. pgvector 扩展已可用（CREATE EXTENSION vector）
 *   3. 或使用 Supabase / Neon 等托管服务（内置 pgvector）
 *
 * 快速启动:
 *   docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg17
 */

import type { Chunk, SearchOptions, SearchResult } from '@rag-sdk/core';
import { BaseVectorStore } from '@rag-sdk/storage';
import type { Pool, PoolConfig, QueryResult } from 'pg';

// ==================== 配置类型 ====================

/** PostgreSQL + pgvector 存储配置 */
export interface PgVectorConfig {
  /** PostgreSQL 连接字符串（优先于单独参数） */
  connectionString?: string;
  /** 数据库主机 */
  host?: string;
  /** 数据库端口 */
  port?: number;
  /** 数据库名 */
  database?: string;
  /** 用户名 */
  user?: string;
  /** 密码 */
  password?: string;
  /** 表名（默认 "rag_chunks"） */
  table?: string;
  /** Schema 名（默认 "public"），会自动创建 */
  schema?: string;
  /** 向量维度（可选，不指定则从首次 upsert 的 chunk 推断） */
  dimension?: number;
  /** pg Pool 配置（直接透传底层选项） */
  pool?: Omit<PoolConfig, 'connectionString' | 'host' | 'port' | 'database' | 'user' | 'password'>;
}

/** PostgreSQL 行格式 */
interface ChunkRow {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[] | null;
  distance?: number;
}

// ==================== 动态加载 pg ====================

/** 懒加载 pg 模块，避免未安装时直接报错 */
async function loadPg(): Promise<{ Pool: new (config?: PoolConfig) => Pool }> {
  try {
    return await import('pg');
  } catch {
    throw new Error(
      '请安装 pg 依赖: pnpm add pg\n（pg 是 @rag-sdk/storage-pgvector 的 peer dependency）',
    );
  }
}

// ==================== 适配器实现 ====================

/**
 * PostgreSQL + pgvector 向量存储适配器
 *
 * 使用 pg (node-postgres) 连接池调用 PostgreSQL，通过 pgvector 扩展
 * 实现高性能向量检索。支持 HNSW 索引、JSONB 元数据过滤。
 */
export class PgVectorStore extends BaseVectorStore {
  private config: PgVectorConfig;
  private table: string;
  private schema: string;
  private dimension: number | null = null;
  private pool: Pool | null = null;
  private initialized = false;

  constructor(config: PgVectorConfig) {
    super();
    this.config = config;
    this.table = config.table ?? 'rag_chunks';
    this.schema = config.schema ?? 'public';
    this.dimension = config.dimension ?? null;
  }

  /** 返回 "schema"."table" 格式的完全限定表名 */
  private get qualifiedTable(): string {
    return `"${this.schema}"."${this.table}"`;
  }

  /** 获取或创建连接池 */
  private async getPool(): Promise<Pool> {
    if (this.pool) return this.pool;

    const pg = await loadPg();

    const poolConfig: PoolConfig = {
      ...(this.config.pool ?? {}),
    };

    if (this.config.connectionString) {
      poolConfig.connectionString = this.config.connectionString;
    } else {
      poolConfig.host = this.config.host ?? 'localhost';
      poolConfig.port = this.config.port ?? 5432;
      poolConfig.database = this.config.database ?? 'postgres';
      poolConfig.user = this.config.user ?? 'postgres';
      poolConfig.password = this.config.password ?? 'postgres';
    }

    this.pool = new pg.Pool(poolConfig);
    return this.pool;
  }

  /** 确保 pgvector 扩展、schema 和表已创建 */
  private async ensureTable(embeddingDimension: number): Promise<void> {
    if (this.initialized && this.dimension === embeddingDimension) return;

    if (this.dimension !== null && this.dimension !== embeddingDimension) {
      throw new Error(
        `向量维度不匹配：表要求 ${this.dimension}，当前 chunk 为 ${embeddingDimension}`,
      );
    }

    const pool = await this.getPool();

    // 启用 pgvector 扩展
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // 自动创建 schema（如果不存在）
    if (this.schema !== 'public') {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
    }

    // 创建表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.qualifiedTable} (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(${embeddingDimension})
      )
    `);

    // 创建 HNSW 索引
    const indexName = `idx_${this.schema}_${this.table}_embedding`;
    const indexExists = await pool.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2`,
      [this.schema, indexName],
    );

    if (indexExists.rows.length === 0) {
      await pool.query(`
        CREATE INDEX "${indexName}" ON ${this.qualifiedTable}
        USING hnsw (embedding vector_cosine_ops)
      `);
    }

    this.dimension = embeddingDimension;
    this.initialized = true;
  }

  // ==================== VectorStore 接口实现 ====================

  /**
   * 插入或更新 chunks
   *
   * @param chunks - 文本块列表
   */
  override async upsert(chunks: Chunk[]): Promise<void> {
    const validChunks = chunks.filter((c) => c.embedding);
    if (validChunks.length === 0) return;

    const dimension = validChunks[0]!.embedding!.length;
    await this.ensureTable(dimension);

    const pool = await this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const c of validChunks) {
        // pgvector 接受数组格式的向量，使用参数化避免 SQL 注入
        const embeddingStr = `[${c.embedding!.join(',')}]`;
        await client.query(
          `INSERT INTO ${this.qualifiedTable} (id, document_id, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)
           ON CONFLICT (id) DO UPDATE SET
             document_id = EXCLUDED.document_id,
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             embedding = EXCLUDED.embedding`,
          [c.id, c.documentId, c.content, JSON.stringify(c.metadata), embeddingStr],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 按文档 ID 替换所有 chunks（先删后插）
   *
   * @param documentId - 文档 ID
   * @param chunks - 文本块列表
   */
  override async upsertByDocument(documentId: string, chunks: Chunk[]): Promise<void> {
    await this.deleteByDocument(documentId);
    await this.upsert(chunks);
  }

  /**
   * 向量相似度搜索（余弦距离）
   *
   * @param query - 查询向量
   * @param options - 搜索选项
   * @returns 搜索结果列表
   */
  override async search(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0;

    const pool = await this.getPool();
    const queryStr = `[${query.join(',')}]`;

    // 构建 WHERE 条件
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        // JSONB 路径查询，精确匹配
        conditions.push(`metadata->>'${key.replace(/'/g, "''")}' = $${params.length + 2}`);
        params.push(String(value));
      }
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // 使用 pgvector 的 <=> 余弦距离运算符
    const sql = `
      SELECT id, document_id, content, metadata, embedding,
             embedding <=> $1::vector AS distance
      FROM ${this.qualifiedTable}
      WHERE embedding IS NOT NULL ${whereClause}
      ORDER BY distance ASC
      LIMIT $${params.length + 2}
    `;

    const result = await pool.query(sql, [queryStr, ...params, topK]);

    const searchResults: SearchResult[] = [];
    for (const row of result.rows) {
      const r = row as ChunkRow;
      // 余弦距离转相似度分数 [0, 1]
      const distance = r.distance ?? 2;
      const score = 1 / (1 + distance);

      if (score < threshold) continue;

      searchResults.push({
        chunk: {
          id: r.id,
          documentId: r.document_id,
          content: r.content,
          metadata: r.metadata,
          embedding: r.embedding ?? undefined,
        },
        score,
        source: 'vector',
      });
    }

    return searchResults;
  }

  /**
   * 按 ID 删除 chunks
   *
   * @param ids - chunk ID 列表
   */
  override async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const pool = await this.getPool();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    await pool.query(
      `DELETE FROM ${this.qualifiedTable} WHERE id IN (${placeholders})`,
      ids,
    );
  }

  /**
   * 按文档 ID 删除所有关联 chunks
   *
   * @param documentId - 文档 ID
   */
  override async deleteByDocument(documentId: string): Promise<void> {
    const pool = await this.getPool();
    await pool.query(
      `DELETE FROM ${this.qualifiedTable} WHERE document_id = $1`,
      [documentId],
    );
  }

  /**
   * 关闭连接池，释放数据库连接
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
    }
  }
}
