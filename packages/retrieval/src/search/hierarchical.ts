import type { EmbeddingProvider, Retriever, RetrieveOptions, SearchResult, VectorStore } from '@ragsdk/core';

/**
 * HierarchicalSearch
 *
 * 分层检索：先粗筛再精选
 *
 * 采用两层检索架构——摘要层粗筛定位相关文档，内容层精选提取具体片段，
 * 适用于大规模文档集合中需要快速定位又保证精度的场景。
 */
export class HierarchicalSearch implements Retriever {
  /**
   * 创建分层检索实例
   *
   * @param embedding - 嵌入向量生成器
   * @param summaryStore - 摘要层向量存储，用于文档级粗筛
   * @param contentStore - 内容层向量存储，用于片段级精选
   * @param summaryTopK - 摘要层取 Top-K 篇文档，默认 3
   * @param contentTopK - 每篇文档取 Top-K 个片段，默认 3
   */
  constructor(
    private embedding: EmbeddingProvider,
    private summaryStore: VectorStore,      // 摘要层向量存储
    private contentStore: VectorStore,       // 内容层向量存储
    private summaryTopK: number = 3,        // 摘要层取 Top-K 篇文档
    private contentTopK: number = 3,        // 每篇文档取 Top-K 个片段
  ) {}

  /**
   * 执行分层检索
   *
   * 先在摘要层粗筛找到最相关的文档，再在内容层对这些文档内的片段精选，
   * 最终按分数排序返回结果。
   *
   * @param query - 查询文本
   * @param options - 检索选项（topK、filter、threshold 等）
   * @returns 分层筛选后的检索结果列表
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    const queryVector = await this.embedding.embed(query);
    const threshold = options?.threshold ?? 0;

    // 1. 摘要层粗筛：找到最相关的文档
    const summaryResults = await this.summaryStore.search(queryVector, {
      topK: this.summaryTopK,
      threshold,
    });

    // 2. 提取命中的文档 ID
    const relevantDocIds = new Set(
      summaryResults.map(r => r.chunk.documentId)
    );

    // 3. 内容层精选：在相关文档内搜索具体内容
    const contentResults = await this.contentStore.search(queryVector, {
      topK: this.summaryTopK * this.contentTopK,
      threshold,
    });

    // 4. 只保留来自相关文档的结果
    const filtered = contentResults
      .filter(r => relevantDocIds.has(r.chunk.documentId));

    // 5. 按文档分组，每组取 contentTopK 个
    const byDoc = new Map<string, SearchResult[]>();
    for (const r of filtered) {
      const list = byDoc.get(r.chunk.documentId) ?? [];
      list.push(r);
      byDoc.set(r.chunk.documentId, list);
    }

    const finalResults: SearchResult[] = [];
    for (const results of byDoc.values()) {
      finalResults.push(...results.slice(0, this.contentTopK));
    }

    return finalResults
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.topK ?? 5);
  }
}
