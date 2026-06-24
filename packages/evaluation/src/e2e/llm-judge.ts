import { z } from 'zod';
import type { LLMProvider, Message } from '@rag-sdk/core';
import type { E2EJudgeResult } from '../types';

/** E2E LLM Judge 评分结果的 Zod schema */
const judgeSchema = z
  .object({
    scores: z.record(z.string(), z.number().min(1).max(10)).describe('各维度评分（1-10）'),
    overallScore: z.number().min(1).max(10).describe('综合评分'),
    feedback: z.string().describe('综合评语'),
    dimensionReasons: z.record(z.string(), z.string()).describe('各维度评分理由'),
  })
  .describe('端到端 LLM 裁判评分结果：对各维度打分并给出综合评语');

/** chatJson 返回类型 */
interface JudgeAnalysis {
  scores: Record<string, number>;
  overallScore: number;
  feedback: string;
  dimensionReasons: Record<string, string>;
}

/** E2ELLMJudge 构造选项 */
export interface E2ELLMJudgeOptions {
  /** 裁判 LLM 实例 */
  judgeLLM: LLMProvider;
  /** 评估维度列表 */
  dimensions?: string[];
}

/** 默认评估维度 */
const DEFAULT_DIMENSIONS = ['检索相关性', '回答准确性', '完整性', '忠实度', '有用性'];

/** 降级评分（LLM 失败时使用） */
const FALLBACK_SCORE = 5;

/**
 * 端到端 LLM 裁判
 *
 * 使用 LLM 对 RAG 系统的端到端结果进行多维度评分，
 * 涵盖检索相关性、回答准确性、完整性、忠实度和有用性等维度。
 * 当 LLM 调用失败时，优雅降级为中间值评分。
 */
export class E2ELLMJudge {
  private readonly judgeLLM: LLMProvider;
  private readonly dimensions: string[];

  /**
   * @param options - 构造选项
   */
  constructor(options: E2ELLMJudgeOptions) {
    this.judgeLLM = options.judgeLLM;
    this.dimensions = options.dimensions ?? DEFAULT_DIMENSIONS;
  }

  /**
   * 对 RAG 系统的端到端结果进行 LLM 裁判评分
   *
   * @param query - 用户查询
   * @param answer - 系统生成的回答
   * @param contexts - 检索到的上下文列表
   * @returns 各维度评分及综合评语
   */
  async judge(query: string, answer: string, contexts: string[]): Promise<E2EJudgeResult> {
    try {
      return await this.judgeWithLLM(query, answer, contexts);
    } catch {
      // LLM 评估失败，降级返回中间值评分
      return this.fallbackResult();
    }
  }

  /**
   * 使用 LLM 进行评估
   *
   * @param query - 用户查询
   * @param answer - 系统生成的回答
   * @param contexts - 检索到的上下文列表
   * @returns LLM 裁判评分结果
   */
  private async judgeWithLLM(
    query: string,
    answer: string,
    contexts: string[],
  ): Promise<E2EJudgeResult> {
    const jsonSchema = z.toJSONSchema(judgeSchema);
    const messages = this.buildMessages(query, answer, contexts);

    const result = await this.judgeLLM.chatJson<JudgeAnalysis>(messages, jsonSchema);

    // 使用 safeParse 验证 LLM 返回数据的形状
    const parsed = judgeSchema.safeParse(result);
    if (parsed.success) {
      return {
        scores: parsed.data.scores,
        overallScore: parsed.data.overallScore,
        feedback: parsed.data.feedback,
        dimensionReasons: parsed.data.dimensionReasons,
      };
    }

    // 验证失败，降级处理
    return this.fallbackResult();
  }

  /**
   * 构建 LLM 评估请求消息
   *
   * @param query - 用户查询
   * @param answer - 系统生成的回答
   * @param contexts - 检索到的上下文列表
   * @returns 消息列表
   */
  private buildMessages(query: string, answer: string, contexts: string[]): Message[] {
    const contextText =
      contexts.length > 0
        ? contexts.map((ctx, i) => `【上下文 ${i + 1}】\n${ctx}`).join('\n\n')
        : '（无检索上下文）';

    const dimensionList = this.dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n');

    const prompt = [
      '你是一个 RAG（检索增强生成）系统的端到端评估专家。',
      '请根据以下信息，对系统回答进行多维度评分。',
      '',
      `【用户查询】\n${query}`,
      '',
      `【检索上下文】\n${contextText}`,
      '',
      `【系统回答】\n${answer}`,
      '',
      '请对以下维度分别打分（1-10 分，10 分为最佳）：',
      dimensionList,
      '',
      '同时给出：',
      '- overallScore：综合所有维度的总评分（1-10）',
      '- feedback：综合评语，说明整体表现的优缺点',
      '- dimensionReasons：每个维度的评分理由',
    ].join('\n');

    return [{ role: 'user', content: prompt }];
  }

  /**
   * 生成降级结果（LLM 评估失败时使用）
   *
   * @returns 各维度均为中间值的评估结果
   */
  private fallbackResult(): E2EJudgeResult {
    const scores: Record<string, number> = {};
    const dimensionReasons: Record<string, string> = {};

    for (const dimension of this.dimensions) {
      scores[dimension] = FALLBACK_SCORE;
      dimensionReasons[dimension] = 'LLM 评估失败';
    }

    return {
      scores,
      overallScore: FALLBACK_SCORE,
      feedback: 'LLM 评估失败',
      dimensionReasons,
    };
  }
}
