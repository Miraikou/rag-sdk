import type { GenerationEvaluator, MetricResult } from '@rag-sdk/core'

/**
 * 中文标点 + 英文标点分词正则
 * 按空白和标点拆分，同时保留中英文标点作为分隔符
 */
const TOKEN_REGEX = /[^a-zA-Z0-9一-鿿]+|[一-鿿]|[a-zA-Z0-9]+/g

/**
 * 将文本切分为 token 列表
 *
 * @param text - 待切分文本
 * @returns token 数组
 */
function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(TOKEN_REGEX)
  return (matches ?? []).filter((t) => /\S/.test(t))
}

/**
 * 提取 n-gram 列表
 *
 * @param tokens - token 数组
 * @param n - n-gram 长度
 * @returns n-gram 字符串数组
 */
function getNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '))
  }
  return ngrams
}

/**
 * BLEU 评估器配置选项
 */
interface BLEUEvaluatorOptions {
  /** 最大 n-gram 阶数，默认 4 */
  maxN?: number
}

/**
 * BLEU（Bilingual Evaluation Understudy）评估器
 *
 * 基于 n-gram 精确率的机器翻译 / 文本生成质量指标。
 * 支持 BLEU-1 到 BLEU-N，默认 BLEU-4。
 *
 * @example
 * ```ts
 * const evaluator = new BLEUEvaluator()
 * const result = evaluator.evaluate('今天天气很好', '今天天气非常好')
 * console.log(result.score) // 0 ~ 1
 * ```
 */
export class BLEUEvaluator implements GenerationEvaluator {
  private readonly maxN: number

  /**
   * @param options - 配置选项
   */
  constructor(options?: BLEUEvaluatorOptions) {
    this.maxN = options?.maxN ?? 4
  }

  /**
   * 计算 BLEU 分数
   *
   * @param answer - 模型生成的回答
   * @param reference - 参考回答（ground truth）
   * @returns 包含 BLEU 分数的 MetricResult
   */
  evaluate(answer: string, reference: string): MetricResult {
    const answerTokens = tokenize(answer)
    const referenceTokens = tokenize(reference)

    const c = answerTokens.length
    const r = referenceTokens.length

    // 边界情况：空文本
    if (c === 0 || r === 0) {
      return {
        name: 'BLEU',
        score: 0,
        reason: c === 0 && r === 0 ? '回答和参考均为空' : c === 0 ? '回答为空' : '参考为空',
        details: { maxN: this.maxN, brevityPenalty: 0, precisions: [] },
      }
    }

    // 计算各阶 n-gram 修正精确率
    const precisions: number[] = []
    for (let n = 1; n <= this.maxN; n++) {
      const answerNgrams = getNgrams(answerTokens, n)
      const referenceNgrams = getNgrams(referenceTokens, n)

      // 统计参考 n-gram 频次
      const refCounts = new Map<string, number>()
      for (const ng of referenceNgrams) {
        refCounts.set(ng, (refCounts.get(ng) ?? 0) + 1)
      }

      // 统计回答 n-gram 频次并裁剪
      const ansCounts = new Map<string, number>()
      for (const ng of answerNgrams) {
        ansCounts.set(ng, (ansCounts.get(ng) ?? 0) + 1)
      }

      let clippedCount = 0
      const totalCount = answerNgrams.length

      for (const [ng, count] of ansCounts) {
        const refCount = refCounts.get(ng) ?? 0
        clippedCount += Math.min(count, refCount)
      }

      const precision = totalCount === 0 ? 0 : clippedCount / totalCount
      precisions.push(precision)
    }

    // 如果任一 p_n 为 0，BLEU = 0
    const hasZero = precisions.some((p) => p === 0)
    if (hasZero) {
      return {
        name: 'BLEU',
        score: 0,
        reason: `存在 ${this.maxN} 阶以内的 n-gram 精确率为 0，BLEU 分数为 0`,
        details: {
          maxN: this.maxN,
          brevityPenalty: this.computeBrevityPenalty(c, r),
          precisions,
        },
      }
    }

    // 对数空间几何平均
    const logPrecisionSum = precisions.reduce((sum, p) => sum + Math.log(p), 0)
    const avgLogPrecision = logPrecisionSum / this.maxN

    // 简短惩罚
    const bp = this.computeBrevityPenalty(c, r)

    const score = bp * Math.exp(avgLogPrecision)

    return {
      name: 'BLEU',
      score,
      reason: `BLEU-${this.maxN} = ${score.toFixed(4)}（简短惩罚 = ${bp.toFixed(4)}，平均对数精确率 = ${avgLogPrecision.toFixed(4)}）`,
      details: {
        maxN: this.maxN,
        brevityPenalty: bp,
        precisions,
      },
    }
  }

  /**
   * 计算简短惩罚（Brevity Penalty）
   *
   * @param c - 回答长度（token 数）
   * @param r - 参考长度（token 数）
   * @returns 简短惩罚系数
   */
  private computeBrevityPenalty(c: number, r: number): number {
    if (c > r) {
      return 1
    }
    return Math.exp(1 - r / c)
  }
}
