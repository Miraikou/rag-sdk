import type { GenerationEvaluator, MetricResult } from '@rag-sdk/core';

/**
 * 中文标点 + 英文标点分词正则
 * 按空白和标点拆分，同时保留中英文标点作为分隔符
 */
const TOKEN_REGEX = /[^a-zA-Z0-9一-鿿]+|[一-鿿]|[a-zA-Z0-9]+/g;

/**
 * 将文本切分为 token 列表
 *
 * @param text - 待切分文本
 * @returns token 数组
 */
function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(TOKEN_REGEX);
  return (matches ?? []).filter((t) => /\S/.test(t));
}

/**
 * 提取 n-gram 列表
 *
 * @param tokens - token 数组
 * @param n - n-gram 长度
 * @returns n-gram 字符串数组
 */
function getNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * ROUGE 评估器变体类型
 */
type ROUGEVariant = '1' | '2' | 'L';

/**
 * ROUGE 评估器配置选项
 */
interface ROUGEEvaluatorOptions {
  /** ROUGE 变体：'1'（unigram）、'2'（bigram）、'L'（LCS），默认 'L' */
  variant?: ROUGEVariant;
}

/**
 * 计算 F1 分数
 *
 * @param precision - 精确率
 * @param recall - 召回率
 * @returns F1 分数
 */
function computeF1(precision: number, recall: number): number {
  if (precision + recall === 0) {
    return 0;
  }
  return (2 * precision * recall) / (precision + recall);
}

/**
 * 使用空间优化的动态规划计算最长公共子序列（LCS）长度
 *
 * 使用 O(min(m, n)) 空间的滚动数组方案。
 *
 * @param a - 第一个 token 数组
 * @param b - 第二个 token 数组
 * @returns LCS 长度
 */
function lcsLength(a: string[], b: string[]): number {
  // 确保 b 是较短的数组以优化空间
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const n = shorter.length;

  // 滚动数组：只需要两行
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= longer.length; i++) {
    for (let j = 1; j <= n; j++) {
      if (longer[i - 1] === shorter[j - 1]) {
        curr[j] = (prev[j - 1] ?? 0) + 1;
      } else {
        curr[j] = Math.max(prev[j] ?? 0, curr[j - 1] ?? 0);
      }
    }
    // 交换引用
    const temp = prev;
    prev = curr;
    curr = temp;
    curr.fill(0);
  }

  return prev[n] ?? 0;
}

/**
 * ROUGE（Recall-Oriented Understudy for Gisting Evaluation）评估器
 *
 * 支持 ROUGE-1（unigram F1）、ROUGE-2（bigram F1）、ROUGE-L（LCS F1）三种变体。
 *
 * @example
 * ```ts
 * const evaluator = new ROUGEEvaluator({ variant: 'L' })
 * const result = evaluator.evaluate('今天天气很好', '今天天气非常好')
 * console.log(result.score) // 0 ~ 1
 * ```
 */
export class ROUGEEvaluator implements GenerationEvaluator {
  private readonly variant: ROUGEVariant;

  /**
   * @param options - 配置选项
   */
  constructor(options?: ROUGEEvaluatorOptions) {
    this.variant = options?.variant ?? 'L';
  }

  /**
   * 计算 ROUGE 分数
   *
   * @param answer - 模型生成的回答
   * @param reference - 参考回答（ground truth）
   * @returns 包含 ROUGE 分数的 MetricResult
   */
  evaluate(answer: string, reference: string): MetricResult {
    const answerTokens = tokenize(answer);
    const referenceTokens = tokenize(reference);

    const { precision, recall, f1 } = this.computeScore(answerTokens, referenceTokens);

    return {
      name: `ROUGE-${this.variant}`,
      score: f1,
      reason: `ROUGE-${this.variant} F1 = ${f1.toFixed(4)}（P = ${precision.toFixed(4)}, R = ${recall.toFixed(4)}）`,
      details: {
        variant: this.variant,
        precision,
        recall,
        f1,
      },
    };
  }

  /**
   * 根据变体计算精确率、召回率和 F1
   *
   * @param answerTokens - 回答 token 列表
   * @param referenceTokens - 参考 token 列表
   * @returns 精确率、召回率、F1
   */
  private computeScore(
    answerTokens: string[],
    referenceTokens: string[],
  ): { precision: number; recall: number; f1: number } {
    // 边界情况
    if (answerTokens.length === 0 && referenceTokens.length === 0) {
      return { precision: 0, recall: 0, f1: 0 };
    }

    if (this.variant === 'L') {
      return this.computeLCS(answerTokens, referenceTokens);
    }

    const n = this.variant === '1' ? 1 : 2;
    return this.computeNgram(answerTokens, referenceTokens, n);
  }

  /**
   * 计算 ROUGE-1 / ROUGE-2 的 n-gram F1
   *
   * @param answerTokens - 回答 token 列表
   * @param referenceTokens - 参考 token 列表
   * @param n - n-gram 阶数
   * @returns 精确率、召回率、F1
   */
  private computeNgram(
    answerTokens: string[],
    referenceTokens: string[],
    n: number,
  ): { precision: number; recall: number; f1: number } {
    const answerNgrams = getNgrams(answerTokens, n);
    const referenceNgrams = getNgrams(referenceTokens, n);

    if (answerNgrams.length === 0 || referenceNgrams.length === 0) {
      return { precision: 0, recall: 0, f1: 0 };
    }

    // 统计参考 n-gram 频次
    const refCounts = new Map<string, number>();
    for (const ng of referenceNgrams) {
      refCounts.set(ng, (refCounts.get(ng) ?? 0) + 1);
    }

    // 统计回答 n-gram 频次并裁剪
    const ansCounts = new Map<string, number>();
    for (const ng of answerNgrams) {
      ansCounts.set(ng, (ansCounts.get(ng) ?? 0) + 1);
    }

    let overlap = 0;
    for (const [ng, count] of ansCounts) {
      const refCount = refCounts.get(ng) ?? 0;
      overlap += Math.min(count, refCount);
    }

    const precision = overlap / answerNgrams.length;
    const recall = overlap / referenceNgrams.length;
    const f1 = computeF1(precision, recall);

    return { precision, recall, f1 };
  }

  /**
   * 计算 ROUGE-L（基于 LCS 的 F1）
   *
   * @param answerTokens - 回答 token 列表
   * @param referenceTokens - 参考 token 列表
   * @returns 精确率、召回率、F1
   */
  private computeLCS(
    answerTokens: string[],
    referenceTokens: string[],
  ): { precision: number; recall: number; f1: number } {
    if (answerTokens.length === 0 || referenceTokens.length === 0) {
      return { precision: 0, recall: 0, f1: 0 };
    }

    const lcsLen = lcsLength(answerTokens, referenceTokens);

    const precision = lcsLen / answerTokens.length;
    const recall = lcsLen / referenceTokens.length;
    const f1 = computeF1(precision, recall);

    return { precision, recall, f1 };
  }
}
