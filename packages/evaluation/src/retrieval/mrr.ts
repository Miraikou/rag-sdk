import type { MetricResult, RetrievalEvaluator, SearchResult } from '@rag-sdk/core'

/**
 * 平均倒数排名（Mean Reciprocal Rank）评估器
 *
 * 衡量第一个相关结果的排名位置，分数越高表示相关结果排名越靠前。
 */
export class MRREvaluator implements RetrievalEvaluator {
  /**
   * 计算 MRR
   *
   * @param results - 检索结果列表（按相关性排序）
   * @param groundTruthIds - 标注的相关文档 ID 列表
   * @returns MRR 指标结果
   */
  evaluate(results: SearchResult[], groundTruthIds: string[]): MetricResult {
    const truthSet = new Set(groundTruthIds)

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result && truthSet.has(result.chunk.id)) {
        return {
          name: 'MRR',
          score: 1 / (i + 1),
          details: {
            firstRelevantRank: i + 1,
          },
        }
      }
    }

    return {
      name: 'MRR',
      score: 0,
      details: {
        firstRelevantRank: 0,
      },
    }
  }
}
