import type { Chunk, Citation, GenerateOptions, LLMProvider } from '@rag-sdk/core'
import type { CitationGenerateResult, PromptTemplate } from './types'
import { StandardGenerator } from './generator'
import { BasePromptTemplate } from './prompt-template'

/**
 * CitationGenerator
 *
 * 带引用标注的答案生成器，继承 StandardGenerator。
 * LLM 会在答案中使用 [1]、[2] 等引用标记，
 * 生成器负责解析这些标记并映射到对应的 Chunk。
 */
export class CitationGenerator extends StandardGenerator {
  /**
   * 创建引用生成器实例
   *
   * @param llm - LLM 提供商实例
   * @param template - Prompt 模板，默认使用引用标注模板
   * @param options - 默认生成选项
   */
  constructor(
    llm: LLMProvider,
    template?: PromptTemplate,
    options?: GenerateOptions,
  ) {
    super(llm, template ?? BasePromptTemplate.citation(), options)
  }

  /**
   * 生成带引用标注的答案
   *
   * 调用 LLM 生成答案（含 [1]、[2] 引用标记），
   * 然后解析引用标记并映射到对应的 Chunk。
   *
   * @param query - 用户查询
   * @param chunks - 检索到的文本块
   * @param options - 生成选项
   * @returns 包含引用解析结果的生成结果
   */
  override async generate(
    query: string,
    chunks: Chunk[],
    options?: GenerateOptions,
  ): Promise<CitationGenerateResult> {
    const opts = { ...this.defaultOptions, ...options }

    // 空 chunks 处理
    if (chunks.length === 0) {
      return {
        answer: '抱歉，无法找到与您问题相关的信息。',
        sources: [],
        citedAnswer: '抱歉，无法找到与您问题相关的信息。',
        sourceList: '',
        metadata: {},
      }
    }

    // 构建消息
    const messages = this.template.format(query, chunks, {
      maxContextLength: opts.maxTokens ? opts.maxTokens * 4 : undefined,
    })

    // 调用 LLM 生成答案
    const rawAnswer = await this.llm.chat(messages, {
      maxTokens: opts.maxTokens,
    })

    const answer = rawAnswer.trim()

    // 解析引用标记
    const { citations, citedAnswer, sourceList } = this.parseCitations(answer, chunks)

    return {
      answer,
      sources: citations,
      citedAnswer,
      sourceList,
      metadata: {},
    }
  }

  /**
   * 解析答案中的引用标记，映射到对应的 Chunk
   *
   * 使用正则 /\[(\d+)\]/g 提取引用编号（从 1 开始），
   * 按编号排序后构建 Citation 列表和来源列表文本。
   *
   * @param answer - LLM 生成的答案文本（含引用标记）
   * @param chunks - 检索到的文本块列表
   * @returns 引用解析结果，包含 citations、citedAnswer、sourceList
   */
  private parseCitations(answer: string, chunks: Chunk[]): {
    citations: Citation[]
    citedAnswer: string
    sourceList: string
  } {
    const citationMap = new Map<number, Citation>()
    const regex = /\[(\d+)\]/g
    let match

    while ((match = regex.exec(answer)) !== null) {
      const idx = parseInt(match[1]!, 10) - 1
      if (idx >= 0 && idx < chunks.length && !citationMap.has(idx)) {
        const chunk = chunks[idx]!
        citationMap.set(idx, {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          content: chunk.content,
          metadata: chunk.metadata,
        })
      }
    }

    // 按编号排序
    const sortedIndices = Array.from(citationMap.keys()).sort((a, b) => a - b)
    const citations = sortedIndices.map((i) => citationMap.get(i)!)

    // 构建来源列表
    const sourceList = sortedIndices
      .map((i) => `[${i + 1}] ${chunks[i]!.content.slice(0, 100)}...`)
      .join('\n')

    return { citations, citedAnswer: answer, sourceList }
  }
}
