import type { SearchResult } from '@rag-sdk/core';

/**
 * RRF（Reciprocal Rank Fusion）
 * 将多路检索结果按排名融合，公式：score = Σ 1/(k + rank)
 * k 默认为 60，只看排名不看原始分数
 */
export class RRFSearch {
  private k: number;

  /**
   * 创建 RRF 融合实例
   *
   * @param k - 平滑常数，防止排名靠前的结果得分过高，默认 60
   */
  constructor(k: number = 60) {
    this.k = k;
  }

  /**
   * 融合多路检索结果
   *
   * @param resultSets - 多路检索结果数组，每个元素为一路检索的结果列表
   * @param topK - 融合后保留的最大结果数量，默认 5
   * @param threshold - 最低分数阈值，低于此值的结果将被过滤，默认 0
   * @returns 按 RRF 分数降序排列的融合结果列表
   */
  fuse(resultSets: SearchResult[][], topK: number = 5, threshold: number = 0): SearchResult[] {
    const scores = new Map<string, { result: SearchResult; score: number }>();

    for (const results of resultSets) {
      for (let rank = 0; rank < results.length; rank++) {
        const result = results[rank]!;
        const rrfScore = 1 / (this.k + rank + 1); // rank 从 0 开始，+1 使其从 1 开始

        const existing = scores.get(result.chunk.id);
        if (existing) {
          existing.score += rrfScore;
        } else {
          scores.set(result.chunk.id, { result: { ...result, source: 'fusion' }, score: rrfScore });
        }
      }
    }

    return Array.from(scores.values())
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ result, score }) => ({ ...result, score }));
  }
}
