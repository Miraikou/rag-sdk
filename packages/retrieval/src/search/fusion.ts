import type { Retriever, RetrieveOptions, SearchResult } from '@rag-sdk/core';

/**
 * 加权融合搜索
 *
 * 并行调用向量搜索与关键词搜索，将两路结果按权重加权合并去重，
 * 适用于需要兼顾语义相似性与关键词精确匹配的场景。
 */
export class FusionSearch implements Retriever {
  /**
   * 创建加权融合搜索实例
   *
   * @param vectorSearch - 向量语义检索器
   * @param keywordSearch - 关键词检索器
   * @param vectorWeight - 向量搜索结果的权重，默认 0.5
   * @param keywordWeight - 关键词搜索结果的权重，默认 0.5
   */
  constructor(
    private vectorSearch: Retriever,
    private keywordSearch: Retriever,
    private vectorWeight: number = 0.5,
    private keywordWeight: number = 0.5,
  ) {}

  /**
   * 执行加权融合检索
   *
   * 并行调用向量搜索与关键词搜索，先对两路结果分别进行 Min-Max 归一化（将分数映射到 [0, 1]），
   * 再按权重加权合并去重。同一 chunk 被两路命中时分数累加。
   *
   * @param query - 查询文本
   * @param options - 检索选项（topK、filter、threshold 等）
   * @returns 按加权融合分数降序排列的检索结果列表
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0;

    // 并行检索，多取一些候选以便融合后仍有足够结果
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch.retrieve(query, { ...options, topK: topK * 2 }),
      this.keywordSearch.retrieve(query, { ...options, topK: topK * 2 }),
    ]);

    // Min-Max 归一化：将分数映射到 [0, 1]
    const normalizedVector = this.minMaxNormalize(vectorResults);
    const normalizedKeyword = this.minMaxNormalize(keywordResults);

    // 以 chunk.id 为键合并去重
    const merged = new Map<string, SearchResult>();

    for (const r of normalizedVector) {
      merged.set(r.chunk.id, {
        ...r,
        score: r.score * this.vectorWeight,
        source: 'fusion',
      });
    }

    for (const r of normalizedKeyword) {
      const existing = merged.get(r.chunk.id);
      if (existing) {
        // 同一 chunk 两路命中，归一化后的分数加权累加
        existing.score += r.score * this.keywordWeight;
      } else {
        merged.set(r.chunk.id, {
          ...r,
          score: r.score * this.keywordWeight,
          source: 'fusion',
        });
      }
    }

    return Array.from(merged.values())
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Min-Max 归一化：将结果列表的分数映射到 [0, 1] 区间
   *
   * 公式：normalized = (score - min) / (max - min)
   *
   * @param results - 待归一化的检索结果列表
   * @returns 归一化后的检索结果列表（分数已更新）
   */
  private minMaxNormalize(results: SearchResult[]): SearchResult[] {
    if (results.length === 0) return [];
    if (results.length === 1) {
      // 单个结果，归一化为 1
      const single = results[0];
      if (!single) return [];
      return [{ ...single, score: 1 }];
    }

    const scores = results.map((r) => r.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;

    if (range === 0) {
      // 所有分数相同，归一化为 0.5
      return results.map((r) => ({ ...r, score: 0.5 }));
    }

    return results.map((r) => ({
      ...r,
      score: (r.score - min) / range,
    }));
  }
}
