import type { Chunk, Citation, GenerateOptions, GenerateResult, Generator, LLMProvider } from '@rag-sdk/core';
import { BasePromptTemplate } from './prompt-template';
import type { PromptTemplate } from './types';

/**
 * StandardGenerator
 *
 * 标准答案生成器，基于 Prompt 模板 + LLM 生成答案。
 * 支持同步生成和流式生成。
 */
export class StandardGenerator implements Generator {
  protected llm: LLMProvider;
  protected template: PromptTemplate;
  protected defaultOptions: GenerateOptions;

  /**
   * 创建标准生成器实例
   *
   * @param llm - LLM 提供商实例
   * @param template - Prompt 模板，默认使用标准 RAG 模板
   * @param options - 默认生成选项
   */
  constructor(
    llm: LLMProvider,
    template?: PromptTemplate,
    options?: GenerateOptions,
  ) {
    this.llm = llm;
    this.template = template ?? BasePromptTemplate.default();
    this.defaultOptions = options ?? {};
  }

  /**
   * 生成答案
   *
   * @param query - 用户查询
   * @param chunks - 检索到的文本块
   * @param options - 生成选项
   * @returns 生成结果（答案 + 来源引用）
   */
  async generate(
    query: string,
    chunks: Chunk[],
    options?: GenerateOptions,
  ): Promise<GenerateResult> {
    const opts = { ...this.defaultOptions, ...options };

    // 空 chunks 处理
    if (chunks.length === 0) {
      return {
        answer: '抱歉，无法找到与您问题相关的信息。',
        sources: [],
        metadata: {},
      };
    }

    // 构建消息
    const messages = this.template.format(query, chunks, {
      maxContextLength: opts.maxTokens ? opts.maxTokens * 4 : undefined,
    });

    // 调用 LLM
    const answer = await this.llm.chat(messages, {
      maxTokens: opts.maxTokens,
    });

    // 构建来源引用
    const sources: Citation[] = opts.includeSources !== false
      ? chunks.map((c) => ({
          chunkId: c.id,
          documentId: c.documentId,
          content: c.content,
          metadata: c.metadata,
        }))
      : [];

    return {
      answer: answer.trim(),
      sources,
      metadata: {},
    };
  }

  /**
   * 流式生成答案
   *
   * @param query - 用户查询
   * @param chunks - 检索到的文本块
   * @returns 逐字符的异步迭代器
   */
  async *generateStream(
    query: string,
    chunks: Chunk[],
  ): AsyncIterable<string> {
    if (chunks.length === 0) {
      yield '抱歉，无法找到与您问题相关的信息。';
      return;
    }

    const messages = this.template.format(query, chunks);
    yield* this.llm.chatStream(messages);
  }
}
