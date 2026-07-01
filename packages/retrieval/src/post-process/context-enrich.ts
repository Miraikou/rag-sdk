import type { Chunk, PostProcessor, SearchResult, VectorStore } from '@ragsdk/core';

/**
 * 上下文丰富后处理器
 *
 * 对检索结果中的每个 chunk，根据其 parentId 或 documentId
 * 从向量存储中检索相邻 chunk，拼接为更完整的上下文。
 *
 * 解决切块导致上下文不完整的问题。
 */
export class ContextEnrichPostProcessor implements PostProcessor {
  private store: VectorStore;
  private windowSize: number;

  /**
   * 创建上下文丰富后处理器实例
   *
   * @param store - 向量存储实例，用于检索相邻 chunk
   * @param options - 配置项
   * @param options.windowSize - 上下文窗口大小（前后各取多少个相邻 chunk），默认 2
   */
  constructor(store: VectorStore, options?: { windowSize?: number }) {
    this.store = store;
    this.windowSize = options?.windowSize ?? 2;
  }

  /**
   * 对检索结果进行上下文丰富
   *
   * 根据每个 chunk 的 parentId 查找父 chunk 的相邻兄弟 chunk，
   * 按顺序拼接为更完整的上下文内容。
   *
   * @param results - 待丰富上下文的检索结果列表
   * @returns 上下文扩展后的检索结果列表
   */
  async process(results: SearchResult[]): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    const enriched: SearchResult[] = [];

    for (const result of results) {
      const chunk = result.chunk;

      // 优先通过 parentId 查找父 chunk 的相邻兄弟
      if (chunk.parentId) {
        const parentResults = await this.store.search(
          chunk.embedding ?? [],
          { topK: 1, filter: { id: chunk.parentId } },
        );

        if (parentResults.length > 0 && parentResults[0]) {
          const parentChunk = parentResults[0].chunk;
          const children = parentChunk.children ?? [];

          // 找到当前 chunk 在兄弟列表中的位置
          const currentIndex = children.indexOf(chunk.id);
          if (currentIndex >= 0) {
            const siblingIds = children.slice(
              Math.max(0, currentIndex - this.windowSize),
              Math.min(children.length, currentIndex + this.windowSize + 1),
            );

            const siblingChunks = await this.fetchChunksByIds(siblingIds);

            // 按顺序拼接兄弟 chunk 的内容
            const contextContent = siblingChunks
              .map((s) => s.content)
              .join('\n');

            enriched.push({
              ...result,
              chunk: {
                ...chunk,
                content: contextContent || chunk.content,
              },
            });
            continue;
          }
        }
      }

      // 没有 parentId 或查找失败时，保留原始结果
      enriched.push(result);
    }

    return enriched;
  }

  /**
   * 按 ID 批量检索 chunk
   *
   * 使用 embedding 搜索 + filter 来间接实现按 ID 查找
   *
   * @param ids - 需要查找的 chunk ID 列表
   * @returns 匹配的 chunk 列表
   */
  private async fetchChunksByIds(ids: string[]): Promise<Chunk[]> {
    if (ids.length === 0) return [];

    const results = await this.store.search([], {
      topK: ids.length,
      filter: { ids },
    });

    return results.map((r) => r.chunk);
  }
}
