import type { EmbeddingProvider, GenerationEvaluator, MetricResult } from '@rag-sdk/core';

/**
 * BERTScore 评估器（基于句子级语义相似度）
 *
 * 使用 EmbeddingProvider 将回答和参考文本编码为向量，
 * 计算余弦相似度作为语义相似性分数。
 *
 * 注意：这是句子级的语义相似度指标，而非 token 级别的 BERTScore。
 * 适用于评估生成文本与参考文本在语义层面的匹配程度。
 *
 * @example
 * ```ts
 * const evaluator = new BERTScoreEvaluator(embeddingProvider)
 * const result = await evaluator.evaluate('今天天气很好', '今天天气非常好')
 * console.log(result.score) // 0 ~ 1
 * ```
 */
export class BERTScoreEvaluator implements GenerationEvaluator {
  private readonly embedding: EmbeddingProvider;

  /**
   * @param embedding - 嵌入向量提供商，用于将文本编码为向量
   */
  constructor(embedding: EmbeddingProvider) {
    this.embedding = embedding;
  }

  /**
   * 计算回答与参考文本之间的语义相似度
   *
   * @param answer - 模型生成的回答
   * @param reference - 参考回答（ground truth）
   * @returns 包含语义相似度分数的 MetricResult
   */
  async evaluate(answer: string, reference: string): Promise<MetricResult> {
    const trimmedAnswer = answer.trim();
    const trimmedReference = reference.trim();

    // 边界情况：空文本
    if (trimmedAnswer.length === 0 || trimmedReference.length === 0) {
      const reason =
        trimmedAnswer.length === 0 && trimmedReference.length === 0
          ? '回答和参考均为空'
          : trimmedAnswer.length === 0
            ? '回答为空'
            : '参考为空';
      return {
        name: 'SemanticSimilarity',
        score: 0,
        reason,
        details: { answerVectorNorm: 0, referenceVectorNorm: 0 },
      };
    }

    // 并行嵌入两段文本
    const [answerVector, referenceVector] = await Promise.all([
      this.embedding.embed(trimmedAnswer),
      this.embedding.embed(trimmedReference),
    ]);

    const similarity = cosineSimilarity(answerVector, referenceVector);
    const answerNorm = vectorNorm(answerVector);
    const referenceNorm = vectorNorm(referenceVector);

    return {
      name: 'SemanticSimilarity',
      score: similarity,
      reason: `语义相似度 = ${similarity.toFixed(4)}（回答向量模 = ${answerNorm.toFixed(4)}, 参考向量模 = ${referenceNorm.toFixed(4)}）`,
      details: {
        answerVectorNorm: answerNorm,
        referenceVectorNorm: referenceNorm,
      },
    };
  }
}

/**
 * 计算两个向量的余弦相似度
 *
 * @param a - 第一个向量
 * @param b - 第二个向量
 * @returns 余弦相似度（0 ~ 1 范围，负值钳制为 0）
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  // 余弦相似度范围 [-1, 1]，钳制负值为 0（文本相似度场景）
  return Math.max(0, dotProduct / denominator);
}

/**
 * 计算向量的 L2 范数
 *
 * @param v - 输入向量
 * @returns 向量的 L2 范数
 */
function vectorNorm(v: number[]): number {
  let sum = 0;
  for (const x of v) {
    sum += x * x;
  }
  return Math.sqrt(sum);
}
