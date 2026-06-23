import type { MetricResult, RetrievalEvaluator, SearchResult } from '@rag-sdk/core'

/** 精确率评估选项 */
interface PrecisionOptions {
  /** 取前 K 个结果进行评估，默认 10 */
  k?: number
}

/**
 * 精确率（Precision@K）评估器
 *
 * 衡量检索结果前 K 个中相关文档的占比。
 */
export class PrecisionEvaluator implements RetrievalEvaluator {
  private readonly k: number

  /**
   * @param options - 评估选项
   */
  constructor(options?: PrecisionOptions) {
    this.k = options?.k ?? 10
  }

  /**
   * 计算 Precision@K
   *
   * @param results - 检索结果列表（按相关性排序）
   * @param groundTruthIds - 标注的相关文档 ID 列表
   * @returns 精确率指标结果
   */
  evaluate(results: SearchResult[], groundTruthIds: string[]): MetricResult {
    if (this.k === 0) {
      return {
        name: 'Precision@K',
        score: 0,
        details: {
          k: 0,
          relevantCount: 0,
          totalRetrieved: 0,
        },
      }
    }

    const topK = results.slice(0, this.k)
    const truthSet = new Set(groundTruthIds)
    const relevantCount = topK.filter((r) => truthSet.has(r.chunk.id)).length

    const score = relevantCount / this.k

    return {
      name: 'Precision@K',
      score,
      details: {
        k: this.k,
        relevantCount,
        totalRetrieved: this.k,
      },
    }
  }
}
