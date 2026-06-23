// 类型 re-export
export type {
  Document,
  Chunk,
  ChunkOptions,
  Chunker,
  DocumentLoader,
  Message,
  LLMProvider,
  EmbeddingProvider,
  TextLoaderOptions,
  MarkdownLoaderOptions,
  PDFLoaderOptions,
  JSONLoaderOptions,
  CSVLoaderOptions,
  WebLoaderOptions,
  CleanerOptions,
  DedupMode,
  DeduplicatorOptions,
  ExtractionOptions,
  AugmentOptions,
  QAPair,
  MarkdownChunkOptions,
  SyncReport,
  DocumentHashRecord,
} from './types';

// 切块策略
export { BaseChunker } from './chunking/base';
export { FixedSizeChunker } from './chunking/fixed-size';
export { RecursiveChunker } from './chunking/recursive';
export { SemanticChunker } from './chunking/semantic';
export { ContextualHeaderChunker } from './chunking/contextual-header';
export { MarkdownChunker } from './chunking/markdown';

// 文档加载器
export { BaseLoader } from './loader/base';
export { TextLoader } from './loader/text-loader';
export { MarkdownLoader } from './loader/markdown-loader';
export { PDFLoader } from './loader/pdf-loader';
export { JSONLoader } from './loader/json-loader';
export { CSVLoader } from './loader/csv-loader';
export { WebLoader } from './loader/web-loader';

// 文档清洗
export { DocumentCleaner } from './cleaner';

// 文档去重
export { DocumentDeduplicator } from './deduplicator';

// 元数据抽取
export { MetadataExtractor } from './metadata-extractor';

// 文档增强
export { DocumentAugmenter } from './augmenter';
