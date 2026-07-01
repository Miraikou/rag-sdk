import type { MetricResult, RetrievalEvaluator, SearchResult } from '@ragsdk/core';

/** 召回率评估选项 */
interface RecallOptions {
  /** 取前 K 个结果进行评估，默认 10 */
  k?: number;
}

/**
 * 召回率（Recall@K）评估器
 *
 * 衡量检索结果中相关文档的覆盖比例，即 ground truth 中有多少文档被检索到。
 */
export class RecallEvaluator implements RetrievalEvaluator {
  private readonly k: number;

  /**
   * @param options - 评估选项
   */
  constructor(options?: RecallOptions) {
    this.k = options?.k ?? 10;
  }

  /**
   * 计算 Recall@K
   *
   * @param results - 检索结果列表（按相关性排序）
   * @param groundTruthIds - 标注的相关文档 ID 列表
   * @returns 召回率指标结果
   */
  evaluate(results: SearchResult[], groundTruthIds: string[]): MetricResult {
    if (groundTruthIds.length === 0) {
      return {
        name: 'Recall@K',
        score: 0,
        reason: '无标注数据',
        details: {
          k: this.k,
          retrievedRelevantCount: 0,
          totalRelevantCount: 0,
        },
      };
    }

    const topK = results.slice(0, this.k);
    const truthSet = new Set(groundTruthIds);
    const retrievedRelevantCount = topK.filter((r) => truthSet.has(r.chunk.id)).length;

    const score = retrievedRelevantCount / truthSet.size;

    return {
      name: 'Recall@K',
      score,
      details: {
        k: this.k,
        retrievedRelevantCount,
        totalRelevantCount: truthSet.size,
      },
    };
  }
}
