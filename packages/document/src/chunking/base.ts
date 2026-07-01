import type { Chunk, Chunker, ChunkOptions, Document } from '@ragsdk/core';

/** 切块策略抽象基类 */
export abstract class BaseChunker implements Chunker {
  protected defaultChunkSize: number;
  protected defaultOverlap: number;
  protected defaultSeparator: string;

  /**
   * @param options - 默认切块选项
   */
  constructor(options?: ChunkOptions) {
    this.defaultChunkSize = options?.chunkSize ?? 500;
    this.defaultOverlap = options?.overlap ?? 50;
    this.defaultSeparator = options?.separator ?? '\n';
  }

  abstract chunk(document: Document, options?: ChunkOptions): Chunk[];

  /**
   * 生成唯一 chunk ID
   *
   * @param documentId - 所属文档 ID
   * @param index - chunk 序号
   * @returns 格式为 `{documentId}_chunk_{index}` 的唯一标识
   */
  protected generateChunkId(documentId: string, index: number): string {
    return `${documentId}_chunk_${index}`;
  }

  /**
   * 合并默认选项和传入选项
   *
   * @param options - 调用方传入的选项（可部分覆盖）
   * @returns 合并后的完整选项
   */
  protected mergeOptions(options?: ChunkOptions): Required<ChunkOptions> {
    return {
      chunkSize: options?.chunkSize ?? this.defaultChunkSize,
      overlap: options?.overlap ?? this.defaultOverlap,
      separator: options?.separator ?? this.defaultSeparator,
    };
  }
}
