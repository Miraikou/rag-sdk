import type { Document, LLMProvider, Retriever } from '@ragsdk/core';

// Re-export 需要用到的核心类型
export type { Document, LLMProvider, Retriever };

// ==================== 图数据模型 ====================

/** 实体 */
export interface Entity {
  /** 实体唯一标识（基于名称规范化生成） */
  id: string;
  /** 实体名称 */
  name: string;
  /** 实体类型（人物、组织、产品、地点、概念等） */
  type: string;
  /** 附加元数据 */
  metadata: Record<string, unknown>;
}

/** 关系 */
export interface Relation {
  /** 源实体 ID */
  source: string;
  /** 目标实体 ID */
  target: string;
  /** 关系类型 */
  type: string;
  /** 附加元数据 */
  metadata: Record<string, unknown>;
}

/** 图数据（抽取结果） */
export interface GraphData {
  /** 抽取到的实体列表 */
  entities: Entity[];
  /** 抽取到的关系列表 */
  relations: Relation[];
}

// ==================== GraphStore ====================

/** 邻居查询结果 */
export interface NeighborResult {
  /** 邻居实体列表 */
  entities: Entity[];
  /** 连接到邻居的关系列表 */
  relations: Relation[];
}

/** 邻居查询选项 */
export interface NeighborOptions {
  /** 关系类型过滤 */
  relationTypes?: string[];
  /** 实体类型过滤 */
  entityTypes?: string[];
  /** 跳数限制，默认 1 */
  hops?: number;
  /** 最大返回数量 */
  limit?: number;
}

/** 图查询结果 */
export interface GraphQueryResult {
  /** 匹配的实体列表 */
  entities: Entity[];
  /** 匹配实体之间的关系列表 */
  relations: Relation[];
  /** 匹配的路径列表（每条路径是实体序列） */
  paths: Entity[][];
}

/** 图存储接口 */
export interface GraphStore {
  /** 批量添加实体 */
  addEntities(entities: Entity[]): Promise<void>;
  /** 批量添加关系 */
  addRelations(relations: Relation[]): Promise<void>;
  /** 根据 ID 获取实体 */
  getEntity(entityId: string): Promise<Entity | null>;
  /** 获取实体的邻居 */
  getNeighbors(entityId: string, options?: NeighborOptions): Promise<NeighborResult>;
  /** 查找两个实体之间的最短路径 */
  findPath(sourceId: string, targetId: string): Promise<Entity[]>;
  /** 关键词图查询 */
  query(query: string): Promise<GraphQueryResult>;
}

// ==================== EntityExtractor ====================

/** 实体抽取器配置 */
export interface EntityExtractorOptions {
  /** LLM 提供商 */
  llmProvider: LLMProvider;
  /** 需要提取的实体类型列表 */
  entityTypes?: string[];
  /** 需要提取的关系类型列表 */
  relationTypes?: string[];
  /** 自定义抽取 prompt（覆盖默认） */
  extractPrompt?: string;
}

// ==================== GraphRetriever ====================

/** 图检索器配置 */
export interface GraphRetrieverOptions {
  /** 图存储 */
  graphStore: GraphStore;
  /** LLM 提供商（用于从 query 中提取实体） */
  llmProvider: LLMProvider;
  /** 最大跳数，默认 2 */
  maxHops?: number;
  /** 每跳最大实体数，默认 10 */
  maxEntities?: number;
}

// ==================== GraphEnhancedRetriever ====================

/** 图增强检索器配置 */
export interface GraphEnhancedRetrieverOptions {
  /** 向量检索器 */
  vectorRetriever: Retriever;
  /** 图检索器 */
  graphRetriever: GraphRetrieverLike;
  /** 图存储 */
  graphStore: GraphStore;
  /** 向量结果权重，默认 0.6 */
  vectorWeight?: number;
  /** 图结果权重，默认 0.4 */
  graphWeight?: number;
  /** 最终返回数量，默认 5 */
  topK?: number;
}

/** 图检索器接口（避免循环引用） */
export interface GraphRetrieverLike {
  /**
   * 执行图检索
   *
   * @param query - 用户查询文本
   * @param options - 检索选项
   * @param options.topK - 返回结果数量
   * @returns 检索结果列表
   */
  retrieve(query: string, options?: { topK?: number }): Promise<import('@ragsdk/core').SearchResult[]>;
}

// ==================== GraphBuilder ====================

/** 构建报告 */
export interface BuildReport {
  /** 最终实体数量 */
  entityCount: number;
  /** 最终关系数量 */
  relationCount: number;
  /** 处理的文档数量 */
  documentCount: number;
  /** 构建过程中的错误 */
  errors: string[];
  /** 每个文档的抽取统计 */
  perDocument: Array<{
    documentId: string;
    entityCount: number;
    relationCount: number;
    error?: string;
  }>;
  /** 构建耗时（毫秒） */
  durationMs: number;
}

/** 图构建器配置 */
export interface GraphBuilderOptions {
  /** 实体关系抽取器 */
  extractor: EntityExtractorLike;
  /** 图存储 */
  graphStore: GraphStore;
  /** 并发数，默认 3 */
  concurrency?: number;
  /** 单文档超时时间（毫秒），默认 30000 */
  timeoutMs?: number;
}

/** 抽取器接口（避免循环引用） */
export interface EntityExtractorLike {
  /**
   * 从文档中抽取实体和关系
   *
   * @param document - 输入文档
   * @returns 抽取的图数据
   */
  extract(document: Document): Promise<GraphData>;
}
