import { z } from 'zod'
import type { GenerationEvaluator, LLMProvider, Message, MetricResult } from '@rag-sdk/core'

/** 声明分解的 Zod schema：从回答中提取原子事实声明 */
const claimsSchema = z.object({
  claims: z.array(z.string()).describe('从回答中提取的所有原子事实声明列表'),
}).describe('声明分解结果：将回答拆解为独立的原子事实声明')

/** 声明验证的 Zod schema：逐条验证声明是否被上下文支持 */
const verdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      claim: z.string().describe('被验证的声明内容'),
      supported: z.boolean().describe('该声明是否被上下文支持'),
      reason: z.string().describe('判断理由'),
    })
  ).describe('所有声明的验证结果列表'),
}).describe('声明验证结果：逐条判断每个声明是否有上下文支撑')

/** chatJson 声明分解的返回类型 */
interface ClaimsAnalysis {
  claims: string[]
}

/** chatJson 声明验证的返回类型 */
interface VerdictsAnalysis {
  verdicts: Array<{
    claim: string
    supported: boolean
    reason: string
  }>
}

/**
 * 忠实度评估器（RAGAS Claim Decomposition）
 *
 * 通过两阶段流程评估生成回答的忠实度：
 * 1. 声明分解：将回答拆解为原子事实声明
 * 2. 声明验证：逐条验证每个声明是否被检索上下文支持
 *
 * 最终得分 = 被支持的声明数 / 总声明数
 */
export class FaithfulnessEvaluator implements GenerationEvaluator {
  private readonly llm: LLMProvider

  /**
   * @param llm - LLM 提供商实例，用于声明分解与验证
   */
  constructor(llm: LLMProvider) {
    this.llm = llm
  }

  /**
   * 评估回答的忠实度
   *
   * @param answer - 系统生成的回答
   * @param _reference - 参考回答（忠实度指标不使用此参数）
   * @param context - 检索到的上下文文本，用于验证声明
   * @returns 忠实度评测结果
   */
  async evaluate(answer: string, _reference: string, context?: string): Promise<MetricResult> {
    // 未提供上下文时直接返回 0 分
    if (!context) {
      return {
        name: 'Faithfulness',
        score: 0,
        reason: '未提供上下文，无法验证忠实度',
        details: {
          totalClaims: 0,
          supportedClaims: 0,
          unsupportedClaims: [],
        },
      }
    }

    // Phase 1: 声明分解
    const claims = await this.decomposeClaims(answer)

    // 零声明视为完全忠实
    if (claims.length === 0) {
      return {
        name: 'Faithfulness',
        score: 1,
        reason: '回答中未提取到事实声明，视为完全忠实',
        details: {
          totalClaims: 0,
          supportedClaims: 0,
          unsupportedClaims: [],
        },
      }
    }

    // Phase 2: 声明验证
    const verdicts = await this.verifyClaims(claims, context)

    // 聚合得分
    const supportedClaims = verdicts.filter((v) => v.supported)
    const unsupportedClaims = verdicts.filter((v) => !v.supported)
    const score = supportedClaims.length / verdicts.length

    return {
      name: 'Faithfulness',
      score,
      reason: `${supportedClaims.length}/${verdicts.length} 条声明被上下文支持`,
      details: {
        totalClaims: verdicts.length,
        supportedClaims: supportedClaims.length,
        unsupportedClaims: unsupportedClaims.map((v) => v.claim),
      },
    }
  }

  /**
   * Phase 1：将回答分解为原子事实声明
   *
   * 优先使用 LLM 进行精确分解，失败时降级为按句子切分。
   *
   * @param answer - 待分解的回答文本
   * @returns 原子事实声明列表
   */
  private async decomposeClaims(answer: string): Promise<string[]> {
    try {
      const schema = z.toJSONSchema(claimsSchema)
      const messages: Message[] = [
        {
          role: 'system',
          content: '你是一个事实声明提取专家。请从给定的回答中提取所有原子事实声明（atomic factual claims）。每条声明应当是独立的、不可再分的事实陈述。',
        },
        {
          role: 'user',
          content: `请从以下回答中提取所有原子事实声明：\n\n${answer}`,
        },
      ]

      const result = await this.llm.chatJson<ClaimsAnalysis>(messages, schema)
      const parsed = claimsSchema.safeParse(result)
      if (parsed.success) {
        return parsed.data.claims.filter((c) => c.trim().length > 0)
      }

      // safeParse 失败时降级
      return this.splitBySentences(answer)
    } catch {
      // LLM 调用失败，降级为按句子切分
      return this.splitBySentences(answer)
    }
  }

  /**
   * Phase 2：验证每条声明是否被上下文支持
   *
   * 优先使用 LLM 进行精确验证，失败时降级为关键词包含率统计。
   *
   * @param claims - 待验证的声明列表
   * @param context - 检索到的上下文文本
   * @returns 每条声明的验证结果
   */
  private async verifyClaims(
    claims: string[],
    context: string
  ): Promise<Array<{ claim: string; supported: boolean; reason: string }>> {
    try {
      const schema = z.toJSONSchema(verdictsSchema)
      const claimsList = claims.map((c, i) => `${i + 1}. ${c}`).join('\n')
      const messages: Message[] = [
        {
          role: 'system',
          content: '你是一个事实验证专家。请根据给定的上下文，逐条判断每个声明是否被上下文支持。只根据上下文中明确提供的信息判断，不要使用外部知识。',
        },
        {
          role: 'user',
          content: `上下文：\n${context}\n\n待验证的声明：\n${claimsList}\n\n请逐条判断每个声明是否被上下文支持。`,
        },
      ]

      const result = await this.llm.chatJson<VerdictsAnalysis>(messages, schema)
      const parsed = verdictsSchema.safeParse(result)
      if (parsed.success) {
        return parsed.data.verdicts
      }

      // safeParse 失败时降级
      return this.fallbackVerify(claims, context)
    } catch {
      // LLM 调用失败，降级为关键词包含率统计
      return this.fallbackVerify(claims, context)
    }
  }

  /**
   * 降级方案：按句子切分文本为声明列表
   *
   * 支持中英文标点符号作为句子分隔符。
   *
   * @param text - 待切分的文本
   * @returns 句子列表
   */
  private splitBySentences(text: string): string[] {
    return text
      .split(/[。.!！?？]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  /**
   * 降级方案：基于关键词包含率验证声明
   *
   * 计算声明中每个词在上下文中出现的比例，
   * 超过 50% 的词被包含则视为被支持。
   *
   * @param claims - 待验证的声明列表
   * @param context - 上下文文本
   * @returns 每条声明的验证结果
   */
  private fallbackVerify(
    claims: string[],
    context: string
  ): Array<{ claim: string; supported: boolean; reason: string }> {
    const contextLower = context.toLowerCase()
    return claims.map((claim) => {
      const words = claim.split(/\s+/).filter((w) => w.length > 0)
      if (words.length === 0) {
        return { claim, supported: true, reason: '空声明视为支持' }
      }

      const hitCount = words.filter((w) => contextLower.includes(w.toLowerCase())).length
      const ratio = hitCount / words.length
      const supported = ratio >= 0.5

      return {
        claim,
        supported,
        reason: supported
          ? `关键词匹配率 ${(ratio * 100).toFixed(1)}% ≥ 50%`
          : `关键词匹配率 ${(ratio * 100).toFixed(1)}% < 50%`,
      }
    })
  }
}
