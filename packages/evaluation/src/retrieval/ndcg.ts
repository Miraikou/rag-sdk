import type { MetricResult, RetrievalEvaluator, SearchResult } from '@rag-sdk/core';

/** NDCG 评估选项 */
interface NDCGOptions {
  /** 取前 K 个结果进行评估，默认 10 */
  k?: number;
}

/**
 * 归一化折损累积增益（Normalized Discounted Cumulative Gain@K）评估器
 *
 * 支持分级相关性，衡量检索结果的排序质量。
 * 结果越相关、排名越靠前，得分越高。
 */
export class NDCGEvaluator implements RetrievalEvaluator {
  private readonly k: number;

  /**
   * @param options - 评估选项
   */
  constructor(options?: NDCGOptions) {
    this.k = options?.k ?? 10;
  }

  /**
   * 计算 NDCG@K
   *
   * @param results - 检索结果列表（按相关性排序）
   * @param groundTruthIds - 标注的相关文档 ID 列表
   * @param relevanceScores - 可选的分级相关性分数（ID → 相关性值），
   *                          未提供时 ground truth 中的 ID 相关性为 1，其余为 0
   * @returns NDCG 指标结果
   */
  evaluate(
    results: SearchResult[],
    groundTruthIds: string[],
    relevanceScores?: Map<string, number>,
  ): MetricResult {
    const topK = results.slice(0, this.k);

    // 构建相关性映射：未提供时使用二值相关性
    const relMap = relevanceScores ?? this.buildBinaryRelevance(groundTruthIds);

    // 计算 DCG
    const dcg = this.computeDCG(topK.map((r) => relMap.get(r.chunk.id) ?? 0));

    // 计算 IDCG：取所有已知相关性分数，按降序排列后计算理想 DCG
    const allRelevances = this.collectAllRelevances(topK, relMap, groundTruthIds);
    allRelevances.sort((a, b) => b - a);
    const idcg = this.computeDCG(allRelevances.slice(0, this.k));

    const score = idcg === 0 ? 0 : dcg / idcg;

    return {
      name: 'NDCG@K',
      score,
      details: {
        k: this.k,
        dcg,
        idcg,
      },
    };
  }

  /**
   * 构建二值相关性映射
   *
   * @param groundTruthIds - 标注的相关文档 ID 列表
   * @returns 相关性映射（ground truth ID → 1，其余 → 0）
   */
  private buildBinaryRelevance(groundTruthIds: string[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const id of groundTruthIds) {
      map.set(id, 1);
    }
    return map;
  }

  /**
   * 收集所有相关性分数，用于计算 IDCG
   *
   * @param topK - 前 K 个检索结果
   * @param relMap - 相关性映射
   * @param groundTruthIds - 标注的相关文档 ID 列表
   * @returns 所有相关性分数数组
   */
  private collectAllRelevances(
    topK: SearchResult[],
    relMap: Map<string, number>,
    groundTruthIds: string[],
  ): number[] {
    // 收集 topK 中所有结果的相关性
    const relevances: number[] = [];
    for (const r of topK) {
      relevances.push(relMap.get(r.chunk.id) ?? 0);
    }

    // 还需考虑 ground truth 中未出现在 topK 里的文档
    const topKIds = new Set(topK.map((r) => r.chunk.id));
    for (const id of groundTruthIds) {
      if (!topKIds.has(id)) {
        relevances.push(relMap.get(id) ?? 0);
      }
    }

    return relevances;
  }

  /**
   * 计算折损累积增益（DCG）
   *
   * 公式：sum(rel_i / log2(i + 2))，其中 i 从 0 开始
   *
   * @param relevances - 按排名顺序的相关性分数数组
   * @returns DCG 值
   */
  private computeDCG(relevances: number[]): number {
    let dcg = 0;
    for (let i = 0; i < relevances.length; i++) {
      const rel = relevances[i] ?? 0;
      dcg += rel / Math.log2(i + 2);
    }
    return dcg;
  }
}
