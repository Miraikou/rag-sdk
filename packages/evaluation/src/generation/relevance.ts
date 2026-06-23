import { z } from 'zod'
import type { GenerationEvaluator, LLMProvider, Message, MetricResult } from '@rag-sdk/core'

/** 问题生成的 Zod schema：从回答中反向生成问题 */
const questionsSchema = z.object({
  questions: z.array(z.string()).describe('从回答中反向生成的问题列表，每个问题应能通过回答得到解答'),
}).describe('问题生成结果：从回答中反向推导出可由该回答解答的问题')

/** chatJson 问题生成的返回类型 */
interface QuestionsAnalysis {
  questions: string[]
}

/** AnswerRelevanceEvaluator 构造选项 */
export interface AnswerRelevanceOptions {
  /** 反向生成的问题数量，默认 3 */
  numQuestions?: number
}

/**
 * 回答相关性评估器（RAGAS Answer Relevance）
 *
 * 通过从回答中反向生成问题，并计算生成问题与原始查询的相似度来评估回答的相关性。
 * 相似度越高，说明回答越贴合查询意图。
 *
 * 计算流程：
 * 1. LLM 从回答中反向生成 N 个问题
 * 2. 计算每个生成问题与原始查询的 TF 余弦相似度
 * 3. 最终得分 = 所有相似度的均值
 */
export class AnswerRelevanceEvaluator implements GenerationEvaluator {
  private readonly llm: LLMProvider
  private readonly numQuestions: number

  /**
   * @param llm - LLM 提供商实例，用于反向生成问题
   * @param options - 配置选项
   */
  constructor(llm: LLMProvider, options?: AnswerRelevanceOptions) {
    this.llm = llm
    this.numQuestions = options?.numQuestions ?? 3
  }

  /**
   * 评估回答与查询的相关性
   *
   * @param answer - 系统生成的回答
   * @param reference - 原始查询（回答相关性是 reference-free 指标，此处 reference 即查询）
   * @returns 回答相关性评测结果
   */
  async evaluate(answer: string, reference: string): Promise<MetricResult> {
    // reference 即为原始查询
    const query = reference

    // 空回答或空查询的特殊处理
    if (!answer.trim() || !query.trim()) {
      return {
        name: 'AnswerRelevance',
        score: 0,
        reason: '回答或查询为空，无法评估相关性',
        details: {
          numQuestions: 0,
          similarities: [],
        },
      }
    }

    // 生成反向问题
    const questions = await this.generateQuestions(answer)

    // 无问题时降级
    if (questions.length === 0) {
      const fallbackScore = this.fallbackOverlap(answer, query)
      return {
        name: 'AnswerRelevance',
        score: fallbackScore,
        reason: '未能生成反向问题，使用关键词重叠作为降级分数',
        details: {
          numQuestions: 0,
          similarities: [],
        },
      }
    }

    // 计算每个生成问题与查询的 TF 余弦相似度
    const similarities = questions.map((q) => this.tfCosineSimilarity(q, query))
    const score = similarities.reduce((sum, s) => sum + s, 0) / similarities.length

    return {
      name: 'AnswerRelevance',
      score,
      reason: `${questions.length} 个反向问题与查询的平均相似度为 ${score.toFixed(3)}`,
      details: {
        numQuestions: questions.length,
        similarities,
      },
    }
  }

  /**
   * 从回答中反向生成问题
   *
   * 优先使用 LLM 生成高质量问题，失败时降级为空列表触发关键词重叠降级。
   *
   * @param answer - 待分析的回答文本
   * @returns 反向生成的问题列表
   */
  private async generateQuestions(answer: string): Promise<string[]> {
    try {
      const schema = z.toJSONSchema(questionsSchema)
      const messages: Message[] = [
        {
          role: 'system',
          content: `你是一个问题生成专家。请根据给定的回答，反向生成 ${this.numQuestions} 个问题。每个问题应当能够通过该回答得到解答，且尽量覆盖回答的不同方面。`,
        },
        {
          role: 'user',
          content: `请根据以下回答生成 ${this.numQuestions} 个问题：\n\n${answer}`,
        },
      ]

      const result = await this.llm.chatJson<QuestionsAnalysis>(messages, schema)
      const parsed = questionsSchema.safeParse(result)
      if (parsed.success) {
        return parsed.data.questions.filter((q) => q.trim().length > 0)
      }

      return []
    } catch {
      // LLM 调用失败，返回空列表触发降级
      return []
    }
  }

  /**
   * 计算两段文本的 TF 余弦相似度
   *
   * 基于词频（Term Frequency）构建向量，计算余弦相似度。
   * 无需外部嵌入模型，纯统计方法。
   *
   * @param textA - 第一段文本
   * @param textB - 第二段文本
   * @returns 余弦相似度，范围 [0, 1]
   */
  private tfCosineSimilarity(textA: string, textB: string): number {
    const tokensA = this.tokenize(textA)
    const tokensB = this.tokenize(textB)

    if (tokensA.length === 0 || tokensB.length === 0) return 0

    // 构建统一词表
    const vocab = new Set([...tokensA, ...tokensB])

    // 计算词频向量
    const tfA = this.buildTfVector(tokensA, vocab)
    const tfB = this.buildTfVector(tokensB, vocab)

    // 余弦相似度：dot(A, B) / (||A|| * ||B||)
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (const word of vocab) {
      const a = tfA.get(word) ?? 0
      const b = tfB.get(word) ?? 0
      dotProduct += a * b
      normA += a * a
      normB += b * b
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
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
      .filter((t) => t.length > 0)
  }

  /**
   * 构建词频向量
   *
   * @param tokens - 分词结果
   * @param vocab - 词表
   * @returns 词频映射
   */
  private buildTfVector(tokens: string[], vocab: Set<string>): Map<string, number> {
    const tf = new Map<string, number>()
    for (const word of vocab) {
      tf.set(word, 0)
    }
    for (const token of tokens) {
      if (vocab.has(token)) {
        tf.set(token, (tf.get(token) ?? 0) + 1)
      }
    }
    return tf
  }

  /**
   * 降级方案：基于关键词重叠计算回答与查询的相关性
   *
   * 计算查询中有多少比例的关键词出现在回答中。
   *
   * @param answer - 回答文本
   * @param query - 查询文本
   * @returns 关键词重叠率，范围 [0, 1]
   */
  private fallbackOverlap(answer: string, query: string): number {
    const queryTokens = new Set(this.tokenize(query))
    if (queryTokens.size === 0) return 0

    const answerLower = answer.toLowerCase()
    let hitCount = 0
    for (const token of queryTokens) {
      if (answerLower.includes(token)) {
        hitCount++
      }
    }

    return hitCount / queryTokens.size
  }
}
