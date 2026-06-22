import type {
  Chunk,
  GenerateOptions,
  GenerateResult,
  Generator,
  LLMProvider,
  Message,
  Retriever,
} from '@rag-sdk/core'
import type { ReflectionTokens, SelfRAGResult } from './types'
import { StandardGenerator } from './generator'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

/** SelfRAGGenerator 配置选项 */
interface SelfRAGOptions {
  /** 最大反思轮数，默认 3 */
  maxRounds?: number
}

// ==================== 反思 Schema 定义 ====================

/** Retrieve 反思：判断是否需要检索 */
const NeedsRetrievalSchema = z.object({
  needsRetrieval: z.boolean().describe('是否需要执行检索来获取额外上下文信息'),
  reason: z.string().describe('判断是否需要检索的理由'),
}).describe('Self-RAG Retrieve 反思：判断当前问题是否需要额外的检索步骤')

/** Relevance 反思：判断检索结果是否相关 */
const RetrievalRelevantSchema = z.object({
  retrievalRelevant: z.boolean().describe('检索到的结果是否与用户问题相关'),
  reason: z.string().describe('判断检索结果相关性的理由'),
}).describe('Self-RAG Relevance 反思：判断检索结果是否与查询相关')

/** Support 反思：判断答案是否忠实于上下文 */
const AnswerFaithfulSchema = z.object({
  answerFaithful: z.boolean().describe('生成的答案是否忠实于提供的上下文，不包含幻觉'),
  reason: z.string().describe('判断答案忠实度的理由'),
}).describe('Self-RAG Support 反思：判断生成的答案是否忠实于检索上下文')

/**
 * 将 Zod schema 转为 JSON Schema（去除 $schema 字段）
 *
 * @param schema - Zod schema 实例
 * @returns 不含 $schema 的 JSON Schema 对象
 */
function toJsonSchema(schema: unknown): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = zodToJsonSchema(schema as any) as Record<string, unknown>
  const { $schema, ...rest } = result
  return rest
}

// ==================== 反思 Schema 类型 ====================

type NeedsRetrievalResult = z.infer<typeof NeedsRetrievalSchema>
type RetrievalRelevantResult = z.infer<typeof RetrievalRelevantSchema>
type AnswerFaithfulResult = z.infer<typeof AnswerFaithfulSchema>

/**
 * SelfRAGGenerator
 *
 * 基于 Self-RAG 范式的生成器，通过多轮反思（Retrieve → Generate → Relevance → Support）
 * 动态决定是否需要检索、评估检索结果的相关性以及答案的忠实度，
 * 在必要时重新检索或重新生成以提升答案质量。
 *
 * 不继承 StandardGenerator，而是内部组合使用。
 */
export class SelfRAGGenerator implements Generator {
  private llm: LLMProvider
  private retriever?: Retriever
  private maxRounds: number
  private standardGenerator: StandardGenerator

  /**
   * 创建 Self-RAG 生成器实例
   *
   * @param llm - LLM 提供商实例
   * @param retriever - 检索器实例（可选，不提供则跳过检索步骤）
   * @param options - 配置选项
   */
  constructor(
    llm: LLMProvider,
    retriever?: Retriever,
    options?: SelfRAGOptions,
  ) {
    this.llm = llm
    this.retriever = retriever
    this.maxRounds = options?.maxRounds ?? 3
    this.standardGenerator = new StandardGenerator(llm)
  }

  /**
   * 基于 Self-RAG 流程生成答案
   *
   * 流程：Retrieve 反思 → 生成答案 → Relevance 反思 → Support 反思
   * - 检索结果不相关时直接结束（重复检索无意义）
   * - 答案不忠实时重新生成，直到满足条件或达到最大轮数
   *
   * @param query - 用户查询
   * @param chunks - 初始检索到的文本块
   * @param options - 生成选项
   * @returns 包含反思标记和轮数信息的生成结果
   */
  async generate(
    query: string,
    chunks: Chunk[],
    options?: GenerateOptions,
  ): Promise<SelfRAGResult> {
    let currentChunks = [...chunks]
    let rounds = 0
    let regenerated = false

    const reflection: ReflectionTokens = {
      needsRetrieval: false,
      retrievalRelevant: true,
      answerFaithful: true,
    }

    // ---------- Step 1: Retrieve 反思 ----------
    const retrievalDecision = await this.reflectNeedsRetrieval(query, currentChunks)

    if (retrievalDecision) {
      reflection.needsRetrieval = retrievalDecision.needsRetrieval

      if (!retrievalDecision.needsRetrieval && currentChunks.length === 0) {
        // 不需要检索且无上下文 → 直接用 LLM 回答
        const directResult = await this.generateDirectAnswer(query, options)
        return {
          ...directResult,
          reflection,
          regenerated: false,
          rounds: 1,
        }
      }

      if (retrievalDecision.needsRetrieval && this.retriever) {
        const retrievedChunks = await this.performRetrieval(query)
        if (retrievedChunks.length > 0) {
          currentChunks = retrievedChunks
        }
      }
    }

    // ---------- 反思循环：生成 + Relevance + Support ----------
    let result: GenerateResult | null = null

    while (rounds < this.maxRounds) {
      rounds++

      // Step 2: 生成答案
      result = await this.standardGenerator.generate(query, currentChunks, options)

      // Step 3: Relevance 反思
      const relevanceDecision = await this.reflectRetrievalRelevant(query, currentChunks)

      if (relevanceDecision) {
        reflection.retrievalRelevant = relevanceDecision.retrievalRelevant

        if (!relevanceDecision.retrievalRelevant) {
          // 检索结果不相关：用相同 query 重复检索没有意义，直接结束循环
          // 使用已有的生成结果，让调用方根据 reflection.retrievalRelevant 判断质量
          break
        }
      }

      // Step 4: Support 反思
      const supportDecision = await this.reflectAnswerFaithful(
        query,
        currentChunks,
        result.answer,
      )

      if (supportDecision) {
        reflection.answerFaithful = supportDecision.answerFaithful

        if (!supportDecision.answerFaithful && rounds < this.maxRounds) {
          // 答案不忠实 → 重新生成
          regenerated = true
          continue
        }
      }

      // 所有反思通过或已达最大轮数 → 结束循环
      break
    }

    // 兜底：如果循环内未成功生成（不应发生，防御性处理）
    if (!result) {
      result = await this.standardGenerator.generate(query, currentChunks, options)
      rounds++
    }

    return {
      ...result,
      reflection,
      regenerated,
      rounds,
    }
  }

  // ==================== 私有方法 ====================

  /**
   * Retrieve 反思：判断当前查询是否需要检索
   *
   * @param query - 用户查询
   * @param chunks - 当前已有的文本块
   * @returns 反思结果，chatJson 失败时返回 null（降级：跳过反思）
   */
  private async reflectNeedsRetrieval(
    query: string,
    chunks: Chunk[],
  ): Promise<NeedsRetrievalResult | null> {
    const contextPreview = chunks.length > 0
      ? `当前已有 ${chunks.length} 条参考资料。`
      : '当前没有任何参考资料。'

    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个检索决策助手。判断用户的问题是否需要从知识库中检索信息来回答。',
      },
      {
        role: 'user',
        content: `${contextPreview}\n用户问题：${query}\n\n请判断是否需要检索。`,
      },
    ]

    try {
      const schema = toJsonSchema(NeedsRetrievalSchema)
      const raw = await this.llm.chatJson<unknown>(messages, schema)
      return NeedsRetrievalSchema.parse(raw)
    } catch {
      // 降级：chatJson 失败时跳过反思
      return null
    }
  }

  /**
   * Relevance 反思：判断检索结果是否与查询相关
   *
   * @param query - 用户查询
   * @param chunks - 当前检索到的文本块
   * @returns 反思结果，chatJson 失败时返回 null（降级：跳过反思）
   */
  private async reflectRetrievalRelevant(
    query: string,
    chunks: Chunk[],
  ): Promise<RetrievalRelevantResult | null> {
    const contextSummary = chunks
      .map((c, i) => `[${i + 1}] ${c.content.slice(0, 200)}`)
      .join('\n')

    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个相关性评估助手。判断提供的参考资料是否与用户问题相关。',
      },
      {
        role: 'user',
        content: `用户问题：${query}\n\n参考资料：\n${contextSummary}\n\n请判断参考资料是否与问题相关。`,
      },
    ]

    try {
      const schema = toJsonSchema(RetrievalRelevantSchema)
      const raw = await this.llm.chatJson<unknown>(messages, schema)
      return RetrievalRelevantSchema.parse(raw)
    } catch {
      // 降级：chatJson 失败时跳过反思
      return null
    }
  }

  /**
   * Support 反思：判断答案是否忠实于提供的上下文
   *
   * @param query - 用户查询
   * @param chunks - 当前检索到的文本块
   * @param answer - 待验证的答案
   * @returns 反思结果，chatJson 失败时返回 null（降级：跳过反思）
   */
  private async reflectAnswerFaithful(
    query: string,
    chunks: Chunk[],
    answer: string,
  ): Promise<AnswerFaithfulResult | null> {
    const contextSummary = chunks
      .map((c, i) => `[${i + 1}] ${c.content.slice(0, 300)}`)
      .join('\n')

    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个忠实度评估助手。判断给定的答案是否完全基于提供的参考资料，没有编造或添加参考资料之外的信息。',
      },
      {
        role: 'user',
        content: [
          `用户问题：${query}`,
          '',
          `参考资料：\n${contextSummary}`,
          '',
          `答案：${answer}`,
          '',
          '请判断答案是否忠实于参考资料。',
        ].join('\n'),
      },
    ]

    try {
      const schema = toJsonSchema(AnswerFaithfulSchema)
      const raw = await this.llm.chatJson<unknown>(messages, schema)
      return AnswerFaithfulSchema.parse(raw)
    } catch {
      // 降级：chatJson 失败时跳过反思
      return null
    }
  }

  /**
   * 执行检索并返回 Chunk 列表
   *
   * @param query - 用户查询
   * @returns 检索到的文本块列表
   */
  private async performRetrieval(query: string): Promise<Chunk[]> {
    if (!this.retriever) {
      return []
    }

    const results = await this.retriever.retrieve(query)
    return results.map((r) => r.chunk)
  }

  /**
   * 不依赖检索上下文，直接用 LLM 回答问题
   *
   * @param query - 用户查询
   * @param options - 生成选项
   * @returns 生成结果（answer + 空 sources）
   */
  private async generateDirectAnswer(
    query: string,
    options?: GenerateOptions,
  ): Promise<GenerateResult> {
    const messages: Message[] = [
      { role: 'system', content: '你是一个知识库助手。请根据你的知识回答用户问题。' },
      { role: 'user', content: query },
    ]

    const answer = await this.llm.chat(messages, {
      maxTokens: options?.maxTokens,
    })

    return {
      answer: answer.trim(),
      sources: [],
      metadata: {},
    }
  }
}
