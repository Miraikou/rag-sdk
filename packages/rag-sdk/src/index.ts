// 核心
export * from '@rag-sdk/core';

// 文档处理
export * from '@rag-sdk/document';

// 向量嵌入
export * from '@rag-sdk/embedding';

// 文档索引（排除与 document 包重复的类型名）
export { IndexingPipeline } from '@rag-sdk/indexing';
export type { IndexingConfig, IndexingReport } from '@rag-sdk/indexing';

// LLM 提供商
export * from '@rag-sdk/llm';

// 向量存储（排除与 document 包重复的 SyncReport / DocumentHashRecord）
export { BaseVectorStore, MemoryStore, IndexManager } from '@rag-sdk/storage';
export type { VectorStoreConfig, IndexManagerOptions } from '@rag-sdk/storage';

// 检索
export * from '@rag-sdk/retrieval';

// 生成
export * from '@rag-sdk/generation';

// 评测
export * from '@rag-sdk/evaluation';

// 知识图谱
export {
  EntityExtractor,
  MemoryGraphStore,
  Neo4jGraphStore,
  GraphRetriever,
  GraphEnhancedRetriever,
  GraphBuilder,
} from '@rag-sdk/knowledge-graph';
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
} from '@rag-sdk/knowledge-graph';

// Pipeline 预设
export { createSimpleRAG } from './pipeline/simple-rag';
export type { SimpleRAGOptions } from './pipeline/simple-rag';
export { createAdvancedRAG } from './pipeline/advanced-rag';
export type { AdvancedRAGOptions } from './pipeline/advanced-rag';
export { PipelineBuilder } from './pipeline/custom';
