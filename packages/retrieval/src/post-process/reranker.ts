import type { PostProcessor, SearchResult } from '@rag-sdk/core';
import type { RerankerScorer } from './types';

/**
 * 重排序后处理器
 *
 * 使用自定义评分函数对检索结果重新排序。
 * 支持交叉编码器（Cross-Encoder）或任意打分模型。
 *
 * 典型用法：
 * - 先用轻量级检索（BM25 / 向量相似度）获取候选集
 * - 再用 Reranker 进行精排
 */
export class RerankerPostProcessor implements PostProcessor {
  private scorer: RerankerScorer;
  private topK: number;

  /**
   * 创建重排序后处理器实例
   *
   * @param scorer - 评分函数，接收 query 和 content，返回相关性分数
   * @param options - 配置项
   * @param options.topK - 重排序后保留的最大结果数量，默认 5
   */
  constructor(scorer: RerankerScorer, options?: { topK?: number }) {
    this.scorer = scorer;
    this.topK = options?.topK ?? 5;
  }

  /**
   * 对检索结果进行重排序
   *
   * 使用评分函数为每个结果计算新的相关性分数，按分数降序排列后取 topK。
   * 原始分数会保存在 chunk 的 metadata 中。
   *
   * @param results - 待重排序的检索结果列表
   * @param query - 用户查询文本，用于评分函数计算相关性
   * @returns 按重排序分数降序排列的结果列表（最多 topK 条）
   */
  async process(results: SearchResult[], query: string): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    // 为每个结果计算重排序分数
    const scored = await Promise.all(
      results.map(async (result) => {
        const rerankScore = await this.scorer(query, result.chunk.content);
        return {
          result,
          rerankScore,
        };
      }),
    );

    // 按重排序分数降序排列
    scored.sort((a, b) => b.rerankScore - a.rerankScore);

    // 取 topK 并更新 score
    return scored.slice(0, this.topK).map(({ result, rerankScore }) => ({
      ...result,
      score: rerankScore,
      chunk: {
        ...result.chunk,
        metadata: {
          ...result.chunk.metadata,
          originalScore: result.score,
          rerankScore,
        },
      },
    }));
  }
}
