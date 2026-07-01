import { z } from 'zod'
import type { Chunk, Generator, LLMProvider } from '@ragsdk/core'
import type { ConsistencyResult } from './types'

/** chatJson 一致性分析的 Zod schema */
const consistencySchema = z.object({
  consistencyScore: z.number().min(0).max(1).describe('多次生成结果的一致性分数，0 表示完全不一致，1 表示完全一致'),
  bestAnswer: z.string().describe('多次生成中质量最好的答案'),
  conflicts: z.array(z.string()).describe('多次生成结果之间的冲突点列表'),
}).describe('一致性检查结果：对比多次生成的答案，评估一致性和冲突')

/** chatJson 一致性分析的返回类型 */
interface ConsistencyAnalysis {
  consistencyScore: number
  bestAnswer: string
  conflicts: string[]
}

/** ConsistencyChecker 构造选项 */
export interface ConsistencyCheckerOptions {
  /** 生成次数，默认 3 */
  rounds?: number
  /** 可选 LLM，用于对比分析多次结果 */
  llm?: LLMProvider
}

/**
 * 一致性检查器
 *
 * 通过多次生成并对比答案，评估 RAG 系统生成结果的稳定性。
 * 支持 LLM 辅助分析（更精确）和简单统计两种模式。
 */
export class ConsistencyChecker {
  private readonly generator: Generator
  private readonly rounds: number
  private readonly llm?: LLMProvider

  /**
   * @param generator - 生成器实例
   * @param options - 配置选项
   */
  constructor(generator: Generator, options?: ConsistencyCheckerOptions) {
    this.generator = generator
    this.rounds = options?.rounds ?? 3
    this.llm = options?.llm
  }

  /**
   * 对给定查询和文档块执行一致性检查
   *
   * @param query - 用户查询
   * @param chunks - 检索到的文档块列表
   * @returns 一致性检查结果
   */
  async check(query: string, chunks: Chunk[]): Promise<ConsistencyResult> {
    // 1. 并发生成 N 次答案
    const results = await Promise.all(
      Array.from({ length: this.rounds }, () => this.generator.generate(query, chunks))
    )
    const answers = results.map((r) => r.answer)

    // 2. 优先使用 LLM 对比分析，失败时降级到简单统计
    if (this.llm) {
      try {
        return await this.checkWithLLM(query, answers)
      } catch {
        // chatJson 失败，降级到简单一致性计算
        return this.checkSimple(answers)
      }
    }

    return this.checkSimple(answers)
  }

  /**
   * 使用 LLM 对比分析多次生成结果
   *
   * @param query - 原始查询
   * @param answers - 多次生成的答案列表
   * @returns 一致性检查结果
   */
  private async checkWithLLM(query: string, answers: string[]): Promise<ConsistencyResult> {
    const llm = this.llm as LLMProvider
    // 使用 Zod v4 内置的 toJSONSchema（项目统一用法，兼容 Zod v4）
    const schema = z.toJSONSchema(consistencySchema)

    const numbered = answers.map((a, i) => `答案 ${i + 1}:\n${a}`).join('\n\n')
    const prompt = [
      '你是一个答案一致性评估专家。请对比以下针对同一问题多次生成的答案，判断它们的一致性。',
      '',
      `问题：${query}`,
      '',
      numbered,
      '',
      '请给出：',
      '1. consistencyScore（0-1）：答案之间的语义一致程度，1 表示完全一致',
      '2. bestAnswer：最完整、最准确的一个答案',
      '3. conflicts：答案之间存在的具体矛盾或差异点列表',
    ].join('\n')

    const result = await llm.chatJson<ConsistencyAnalysis>(
      [{ role: 'user', content: prompt }],
      schema,
    )

    // 使用 safeParse 验证 LLM 返回数据的形状
    const parsed = consistencySchema.safeParse(result)
    if (parsed.success) {
      return {
        answers,
        consistencyScore: parsed.data.consistencyScore,
        bestAnswer: parsed.data.bestAnswer,
        conflicts: parsed.data.conflicts,
      }
    }

    // 验证失败时也降级到简单计算
    return this.checkSimple(answers)
  }

  /**
   * 简单一致性计算（无 LLM 时的降级方案）
   *
   * 以完全相同答案的占比作为一致性分数，
   * 出现次数最多的答案作为最佳答案。
   *
   * @param answers - 多次生成的答案列表
   * @returns 一致性检查结果
   */
  private checkSimple(answers: string[]): ConsistencyResult {
    // 统计每个答案出现的次数
    const counts = new Map<string, number>()
    for (const answer of answers) {
      counts.set(answer, (counts.get(answer) ?? 0) + 1)
    }

    // 找出出现次数最多的答案
    let bestAnswer = ''
    let maxCount = 0
    for (const [answer, count] of counts) {
      if (count > maxCount) {
        maxCount = count
        bestAnswer = answer
      }
    }

    // 一致性分数 = 最多出现次数 / 总数
    const consistencyScore = answers.length > 0 ? maxCount / answers.length : 0

    return {
      answers,
      consistencyScore,
      bestAnswer,
      conflicts: [],
    }
  }
}
