import type { LLMProvider, PostProcessor, SearchResult } from '@ragsdk/core';

/**
 * 压缩后处理器
 *
 * 使用 LLM 对检索结果的内容进行压缩/摘要，
 * 提取与 query 最相关的信息，减少 token 消耗。
 *
 * 与 SelectiveContextPostProcessor 的区别：
 * - 本处理器用 LLM 重写/摘要内容
 * - SelectiveContextPostProcessor 从原文中筛选句子
 */
export class CompressionPostProcessor implements PostProcessor {
  private llm: LLMProvider;
  private maxTokens: number;

  /**
   * 创建压缩后处理器实例
   *
   * @param llm - LLM 提供者实例，用于内容压缩/摘要
   * @param options - 配置项
   * @param options.maxTokens - 压缩后的最大字数限制，默认 200
   */
  constructor(llm: LLMProvider, options?: { maxTokens?: number }) {
    this.llm = llm;
    this.maxTokens = options?.maxTokens ?? 200;
  }

  /**
   * 对检索结果进行内容压缩
   *
   * 使用 LLM 对每个 chunk 的内容进行摘要，提取与 query 最相关的信息。
   * 压缩前后的长度信息会记录在 chunk 的 metadata 中。
   *
   * @param results - 待压缩的检索结果列表
   * @param query - 用户查询文本，用于指导压缩方向
   * @returns 内容压缩后的检索结果列表
   */
  async process(results: SearchResult[], query: string): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    const compressed: SearchResult[] = [];

    for (const result of results) {
      const summary = await this.compressContent(result.chunk.content, query);

      compressed.push({
        ...result,
        chunk: {
          ...result.chunk,
          metadata: {
            ...result.chunk.metadata,
            originalLength: result.chunk.content.length,
            compressedLength: summary.length,
          },
          content: summary,
        },
      });
    }

    return compressed;
  }

  /**
   * 使用 LLM 压缩 chunk 内容
   *
   * @param content - 原始 chunk 内容
   * @param query - 用户查询文本，用于指导压缩方向
   * @returns 压缩后的文本摘要
   */
  private async compressContent(content: string, query: string): Promise<string> {
    const response = await this.llm.chat(
      [
        {
          role: 'system',
          content: `你是一个文本压缩助手。请提取以下文本中与问题最相关的信息，用简洁的语言重新表述。
规则：
- 只保留与问题相关的关键信息
- 控制在 ${this.maxTokens} 字以内
- 保持原文的专业术语和关键数据
- 直接输出压缩结果，不要加前缀`,
        },
        {
          role: 'user',
          content: `问题：${query}\n\n原文：${content}`,
        },
      ],
      { maxTokens: this.maxTokens },
    );

    return response.trim();
  }
}
