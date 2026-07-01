// 后处理器共享类型（均从 @ragsdk/core 导出）
export type {
  PostProcessor,
  SearchResult,
  Chunk,
  LLMProvider,
  Message,
  ChatOptions,
} from '@ragsdk/core';

/** 重排序评分函数 */
export type RerankerScorer = (query: string, content: string) => Promise<number>;
