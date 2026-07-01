import type { Retriever, RetrieveOptions, SearchResult, Chunk, VectorStore } from '@ragsdk/core';

/**
 * SmallToBigSearch
 *
 * 小块检索、大块回溯策略
 *
 * 先检索细粒度文档片段（小块），再通过父子关系回溯到更完整的上下文（大块），
 * 兼顾检索精度与上下文完整性。
 */
export class SmallToBigSearch implements Retriever {
  /**
   * 创建小块到大块回溯搜索实例
   *
   * @param innerRetriever - 内部检索器，用于检索小块
   * @param store - 向量存储后端
   * @param allChunks - 所有 chunk 的映射表（含父子关系），用于回溯查找父 chunk
   */
  constructor(
    private innerRetriever: Retriever,
    private store: VectorStore,
    private allChunks: Map<string, Chunk> = new Map(),
  ) {}

  /** 注册所有 chunks（包含父子关系），用于回溯查找父 chunk */
  registerChunks(chunks: Chunk[]): void {
    for (const chunk of chunks) {
      this.allChunks.set(chunk.id, chunk);
    }
  }

  /**
   * 执行小块检索并回溯父块
   *
   * 先用内部检索器检索小块，再根据父子关系回溯到更大的上下文块。
   * 若小块没有父块则保留原结果。
   *
   * @param query - 查询文本
   * @param options - 检索选项（topK、filter 等）
   * @returns 回溯父块后的检索结果列表
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    // 1. 用内部检索器检索小块
    const smallResults = await this.innerRetriever.retrieve(query, options);

    // 2. 回溯父块
    const parentResults: SearchResult[] = [];
    const seenParentIds = new Set<string>();

    for (const result of smallResults) {
      const parentId = result.chunk.parentId;

      if (parentId && !seenParentIds.has(parentId)) {
        seenParentIds.add(parentId);
        const parentChunk = this.allChunks.get(parentId);

        if (parentChunk) {
          parentResults.push({
            chunk: parentChunk,
            score: result.score, // 保留小块的分数
            source: result.source,
          });
        }
      } else if (!parentId) {
        // 没有父块，保留原结果
        parentResults.push(result);
      }
    }

    return parentResults;
  }
}
