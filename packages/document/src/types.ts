// Re-export 核心类型
export type {
  Document,
  Chunk,
  ChunkOptions,
  Chunker,
  DocumentLoader,
  Message,
  LLMProvider,
  EmbeddingProvider,
} from '@rag-sdk/core';

// ==================== Loader Options ====================

/** 文本加载器选项 */
export interface TextLoaderOptions {
  /** 文件编码，默认 utf-8 */
  encoding?: BufferEncoding;
}

/** Markdown 加载器选项 */
export interface MarkdownLoaderOptions {
  /** 是否按标题拆分为多个 Document */
  splitByHeading?: boolean;
  /** 拆分依据的标题级别（1-3），默认 1 */
  headingLevel?: 1 | 2 | 3;
}

/** PDF 加载器选项 */
export interface PDFLoaderOptions {
  /** 是否按页拆分为多个 Document，默认 true */
  splitByPage?: boolean;
}

/** JSON 加载器选项 */
export interface JSONLoaderOptions {
  /** 提取内容的字段路径（如 "data.items"） */
  contentPath?: string;
  /** 提取为元数据的字段路径列表 */
  metadataPaths?: string[];
}

/** CSV 加载器选项 */
export interface CSVLoaderOptions {
  /** 字段分隔符，默认 ',' */
  delimiter?: string;
  /** 作为内容的列名，空则合并所有列 */
  contentColumns?: string[];
  /** 首行是否为表头，默认 true */
  headerRow?: boolean;
}

/** 网页加载器选项 */
export interface WebLoaderOptions {
  /** 提取正文的 CSS 选择器，默认 'body' */
  selector?: string;
  /** 是否保留图片 alt 文本 */
  includeImageAlt?: boolean;
  /** 请求超时时间（毫秒），默认 30000 */
  timeout?: number;
}

// ==================== Cleaner ====================

/** 文档清洗器选项 */
export interface CleanerOptions {
  /** 去除 HTML 标签，默认 true */
  removeHtml?: boolean;
  /** 合并多余空白，默认 true */
  removeExtraWhitespace?: boolean;
  /** 去除页眉页脚，默认 false */
  removeHeaderFooter?: boolean;
  /** 去除特殊字符，默认 false */
  removeSpecialChars?: boolean;
}

// ==================== Deduplicator ====================

/** 去重模式 */
export type DedupMode = 'hash' | 'embedding' | 'both';

/** 文档去重器选项 */
export interface DeduplicatorOptions {
  /** 去重模式，默认 'hash' */
  mode?: DedupMode;
  /** Embedding 模式下判定重复的相似度阈值，默认 0.95 */
  similarityThreshold?: number;
}

// ==================== Metadata Extractor ====================

/** 元数据抽取选项 */
export interface ExtractionOptions {
  /** 是否使用 LLM 提取高级元数据（主题、关键词、摘要） */
  useLLM?: boolean;
  /** 主题分类候选列表 */
  categories?: string[];
  /** 最大关键词数量，默认 5 */
  maxKeywords?: number;
}

// ==================== Augmenter ====================

/** 文档增强选项 */
export interface AugmentOptions {
  /** 是否生成摘要，默认 true */
  generateSummary?: boolean;
  /** 是否生成关键词，默认 true */
  generateKeywords?: boolean;
  /** 是否生成 QA 对，默认 false */
  generateQA?: boolean;
  /** QA 对数量，默认 3 */
  qaPairCount?: number;
}

/** QA 对 */
export interface QAPair {
  question: string;
  answer: string;
}

// ==================== Markdown Chunker ====================

/** Markdown 切块选项 */
export interface MarkdownChunkOptions {
  /** 最大标题切分层级（1-6），默认 2 */
  maxHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** 目标块大小（字符数），默认 500 */
  chunkSize?: number;
  /** 是否保留标题行在 chunk 内容中，默认 true */
  includeHeadings?: boolean;
}

// ==================== Index Manager ====================

/** 增量同步报告 */
export interface SyncReport {
  /** 新增文档数 */
  added: number;
  /** 更新文档数 */
  updated: number;
  /** 删除文档数 */
  deleted: number;
  /** 未变化文档数 */
  unchanged: number;
}

/** 文档 Hash 记录 */
export interface DocumentHashRecord {
  documentId: string;
  hash: string;
  updatedAt: string;
}
