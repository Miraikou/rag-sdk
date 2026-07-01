import { z } from 'zod';
import type { LLMProvider, Message, MetricResult } from '@ragsdk/core';

/** 上下文相关性判断的 Zod schema */
const judgmentsSchema = z
  .object({
    judgments: z
      .array(
        z.object({
          index: z.number().describe('上下文的索引（从 0 开始）'),
          relevant: z.boolean().describe('该上下文是否与查询相关'),
          reason: z.string().describe('判断理由'),
        }),
      )
      .describe('所有上下文的相关性判断结果列表'),
  })
  .describe('上下文相关性判断结果：逐条评估每个上下文与查询的相关性');

/** chatJson 相关性判断的返回类型 */
interface JudgmentsAnalysis {
  judgments: Array<{
    index: number;
    relevant: boolean;
    reason: string;
  }>;
}

/** ContextRelevanceEvaluator 构造选项 */
export interface ContextRelevanceOptions {
  /** 评估的最大上下文数量（取前 k 个），默认评估全部 */
  k?: number;
}

/**
 * 上下文相关性评估器（RAGAS Context Precision）
 *
 * 基于 Average Precision（AP）评估检索上下文与查询的相关性。
 * 对每个上下文片段进行相关性判断，并以 AP 方式聚合得分，
 * 鼓励将相关内容排在靠前的位置。
 *
 * 计算流程：
 * 1. LLM 逐条判断每个上下文是否与查询相关
 * 2. 对每个相关位置 k，计算 P@k = 前 k 个中相关数 / k
 * 3. 最终得分 = 所有相关位置的 P@k 均值
 */
export class ContextRelevanceEvaluator {
  private readonly llm: LLMProvider;
  private readonly k: number | undefined;

  /**
   * @param llm - LLM 提供商实例，用于判断上下文相关性
   * @param options - 配置选项
   */
  constructor(llm: LLMProvider, options?: ContextRelevanceOptions) {
    this.llm = llm;
    this.k = options?.k;
  }

  /**
   * 评估检索上下文与查询的相关性
   *
   * @param query - 用户查询
   * @param contexts - 检索到的上下文文本列表（按排序顺序）
   * @returns 上下文相关性评测结果
   */
  async evaluate(query: string, contexts: string[]): Promise<MetricResult> {
    // 空上下文列表的特殊处理
    if (contexts.length === 0) {
      return {
        name: 'ContextRelevance',
        score: 0,
        reason: '未提供上下文，无法评估相关性',
        details: {
          totalContexts: 0,
          relevantCount: 0,
          precisionAtK: [],
        },
      };
    }

    // 按 k 值截取上下文
    const evalContexts = this.k !== undefined ? contexts.slice(0, this.k) : contexts;

    // 获取相关性判断
    const relevantFlags = await this.judgeRelevance(query, evalContexts);

    // 计算 Average Precision
    const precisionAtK: number[] = [];
    let relevantCount = 0;

    for (let i = 0; i < relevantFlags.length; i++) {
      if (relevantFlags[i]) {
        relevantCount++;
        // P@k = 前 (i+1) 个中相关数 / (i+1)
        const precisionAtPosition = relevantCount / (i + 1);
        precisionAtK.push(precisionAtPosition);
      }
    }

    // AP = 所有相关位置的 P@k 均值
    const score =
      precisionAtK.length > 0
        ? precisionAtK.reduce((sum, p) => sum + p, 0) / precisionAtK.length
        : 0;

    return {
      name: 'ContextRelevance',
      score,
      reason: `${relevantCount}/${evalContexts.length} 个上下文与查询相关，AP = ${score.toFixed(3)}`,
      details: {
        totalContexts: evalContexts.length,
        relevantCount,
        precisionAtK,
      },
    };
  }

  /**
   * 逐条判断上下文与查询的相关性
   *
   * 优先使用 LLM 进行精确判断，失败时降级为 Jaccard 关键词重叠。
   *
   * @param query - 用户查询
   * @param contexts - 上下文文本列表
   * @returns 布尔数组，表示每个上下文是否相关
   */
  private async judgeRelevance(query: string, contexts: string[]): Promise<boolean[]> {
    try {
      const schema = z.toJSONSchema(judgmentsSchema);
      const contextsList = contexts.map((c, i) => `[${i}] ${c}`).join('\n\n');
      const messages: Message[] = [
        {
          role: 'system',
          content:
            '你是一个检索相关性评估专家。请根据给定的查询，逐条判断每个上下文片段是否与查询相关。只判断上下文是否包含对回答查询有用的信息，不要考虑其他因素。',
        },
        {
          role: 'user',
          content: `查询：${query}\n\n上下文片段：\n${contextsList}\n\n请逐条判断每个上下文是否与查询相关。`,
        },
      ];

      const result = await this.llm.chatJson<JudgmentsAnalysis>(messages, schema);
      const parsed = judgmentsSchema.safeParse(result);
      if (parsed.success) {
        // 构建结果数组，处理 LLM 可能遗漏某些索引的情况
        const judgments = parsed.data.judgments;
        return contexts.map((_, i) => {
          const judgment = judgments.find((j) => j.index === i);
          return judgment?.relevant ?? false;
        });
      }

      // safeParse 失败时降级
      return this.fallbackJudge(query, contexts);
    } catch {
      // LLM 调用失败，降级为 Jaccard 关键词重叠
      return this.fallbackJudge(query, contexts);
    }
  }

  /**
   * 降级方案：基于 Jaccard 关键词重叠判断相关性
   *
   * 计算查询与上下文的 Jaccard 相似系数，
   * 超过阈值 0.1 则视为相关。
   *
   * @param query - 用户查询
   * @param contexts - 上下文文本列表
   * @returns 布尔数组，表示每个上下文是否相关
   */
  private fallbackJudge(query: string, contexts: string[]): boolean[] {
    const queryTokens = new Set(this.tokenize(query));

    return contexts.map((context) => {
      const contextTokens = new Set(this.tokenize(context));

      // Jaccard = |A ∩ B| / |A ∪ B|
      const union = new Set([...queryTokens, ...contextTokens]);
      if (union.size === 0) return false;

      let intersectionCount = 0;
      for (const token of queryTokens) {
        if (contextTokens.has(token)) {
          intersectionCount++;
        }
      }

      const jaccard = intersectionCount / union.size;
      return jaccard >= 0.1;
    });
  }

  /**
   * 将文本分词为小写 token 列表
   *
   * 支持中英文混合文本，按空白和非字母数字字符切分。
   *
   * @param text - 待分词的文本
   * @returns 小写 token 数组
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9一-鿿]+/)
      .filter((t) => t.length > 0);
  }
}
