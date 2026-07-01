// 核心
export * from '@ragsdk/core';

// 文档处理
export * from '@ragsdk/document';

// 向量嵌入
export * from '@ragsdk/embedding';

// 文档索引（排除与 document 包重复的类型名）
export { IndexingPipeline } from '@ragsdk/indexing';
export type { IndexingConfig, IndexingReport } from '@ragsdk/indexing';

// LLM 提供商
export * from '@ragsdk/llm';

// 向量存储（排除与 document 包重复的 SyncReport / DocumentHashRecord）
export { BaseVectorStore, MemoryStore, IndexManager } from '@ragsdk/storage';
export type { VectorStoreConfig, IndexManagerOptions } from '@ragsdk/storage';

// 检索
export * from '@ragsdk/retrieval';

// 生成
export * from '@ragsdk/generation';

// 评测
export * from '@ragsdk/evaluation';

// 知识图谱
export {
  EntityExtractor,
  MemoryGraphStore,
  Neo4jGraphStore,
  GraphRetriever,
  GraphEnhancedRetriever,
  GraphBuilder,
} from '@ragsdk/knowledge-graph';
export type {
  Entity,
  Relation,
  GraphData,
  GraphStore,
  GraphQueryResult,
  NeighborResult,
  NeighborOptions,
  EntityExtractorOptions,
  GraphRetrieverOptions,
  GraphEnhancedRetrieverOptions,
  GraphBuilderOptions,
  BuildReport,
} from '@ragsdk/knowledge-graph';

// Pipeline 预设
export { createSimpleRAG } from './pipeline/simple-rag';
export type { SimpleRAGOptions } from './pipeline/simple-rag';
export { createAdvancedRAG } from './pipeline/advanced-rag';
export type { AdvancedRAGOptions } from './pipeline/advanced-rag';
export { PipelineBuilder } from './pipeline/custom';
