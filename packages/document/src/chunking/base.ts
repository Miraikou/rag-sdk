import type { Chunk, Chunker, ChunkOptions, Document } from '@rag-sdk/core';

/** 切块策略抽象基类 */
export abstract class BaseChunker implements Chunker {
  protected defaultChunkSize: number;
  protected defaultOverlap: number;
  protected defaultSeparator: string;

  constructor(options?: ChunkOptions) {
    this.defaultChunkSize = options?.chunkSize ?? 500;
    this.defaultOverlap = options?.overlap ?? 50;
    this.defaultSeparator = options?.separator ?? '\n';
  }

  abstract chunk(document: Document, options?: ChunkOptions): Chunk[];

  /** 生成唯一 chunk ID */
  protected generateChunkId(documentId: string, index: number): string {
    return `${documentId}_chunk_${index}`;
  }

  /** 合并默认选项和传入选项 */
  protected mergeOptions(options?: ChunkOptions): Required<ChunkOptions> {
    return {
      chunkSize: options?.chunkSize ?? this.defaultChunkSize,
      overlap: options?.overlap ?? this.defaultOverlap,
      separator: options?.separator ?? this.defaultSeparator,
    };
  }
}
