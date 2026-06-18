import type {
  Chunk,
  Chunker,
  Document,
  DocumentLoader,
  EmbeddingProvider,
  VectorStore,
} from '@rag-sdk/core';

/** 文档清洗器接口 */
export interface DocumentCleaner {
  clean(documents: Document[]): Promise<Document[]>;
}

/** 文档去重器接口 */
export interface DocumentDeduplicator {
  deduplicate(documents: Document[]): Promise<Document[]>;
}

/** 元数据抽取器接口 */
export interface MetadataExtractor {
  extract(documents: Document[]): Promise<Document[]>;
}

/** 文档增强器接口 */
export interface DocumentAugmenter {
  augment(documents: Document[]): Promise<Document[]>;
}

/** Indexing Pipeline 配置 */
export interface IndexingConfig {
  /** 切块策略（必填） */
  chunker: Chunker;
  /** 向量嵌入（必填） */
  embedding: EmbeddingProvider;
  /** 向量存储（必填） */
  store: VectorStore;

  /** 文档加载器（可选） */
  loader?: DocumentLoader;
  /** 文档清洗器（可选） */
  cleaner?: DocumentCleaner;
  /** 文档去重器（可选） */
  deduplicator?: DocumentDeduplicator;
  /** 元数据抽取器（可选） */
  metadataExtractor?: MetadataExtractor;
  /** 文档增强器（可选） */
  augmenter?: DocumentAugmenter;
}

/** Indexing 执行报告 */
export interface IndexingReport {
  documentsLoaded: number;
  documentsAfterDedup: number;
  chunksCreated: number;
  chunksEmbedded: number;
  chunksStored: number;
  duration: number;
}
