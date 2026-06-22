import type { Chunk, ChunkOptions, Document, LLMProvider } from '@rag-sdk/core';
import { BaseChunker } from './base';
import type { Chunker } from '@rag-sdk/core';

/**
 * 上下文头切块器（装饰器模式）
 *
 * 先用内部 Chunker 切块，再用 LLM 为每个 chunk 生成上下文摘要，
 * 拼装为 Contextual Chunk Header 插入到 chunk 内容前。
 *
 * 解决 chunk 脱离上下文后语义不完整的问题。
 */
export class ContextualHeaderChunker extends BaseChunker {
  private llm: LLMProvider;
  private innerChunker: Chunker;
  private headerTemplate: string;
  private includeParentContext: boolean;

  /**
   * @param options - 上下文头切块配置
   * @param options.llm - LLM 提供商，用于生成上下文摘要
   * @param options.innerChunker - 内部切块器，负责实际切分
   * @param options.chunkSize - 块大小，默认 500
   * @param options.headerTemplate - header 模板，支持 {summary}/{title}/{section} 占位符，默认 `[摘要: {summary}]`
   * @param options.includeParentContext - 是否包含父文档全文作为上下文，默认 true
   */
  constructor(options: {
    llm: LLMProvider;
    innerChunker: Chunker;
    chunkSize?: number;
    headerTemplate?: string;
    includeParentContext?: boolean;
  }) {
    super({ chunkSize: options.chunkSize ?? 500 });
    this.llm = options.llm;
    this.innerChunker = options.innerChunker;
    this.headerTemplate = options.headerTemplate ?? '[摘要: {summary}]';
    this.includeParentContext = options.includeParentContext ?? true;
  }

  /**
   * 同步切块（不含 LLM 生成的 header）
   *
   * 如需 header，请使用 chunkAsync 方法
   *
   * @param document - 待切分的文档
   * @param options - 切块选项
   * @returns 切分后的 chunk 数组（无上下文头）
   */
  chunk(document: Document, options?: ChunkOptions): Chunk[] {
    return this.innerChunker.chunk(document, options);
  }

  /**
   * 异步切块 + 生成 Contextual Header
   *
   * 先切块，再用 LLM 为每个 chunk 生成上下文摘要
   *
   * @param document - 待切分的文档
   * @param options - 切块选项
   * @returns 包含上下文头的 chunk 数组
   */
  async chunkAsync(document: Document, options?: ChunkOptions): Promise<Chunk[]> {
    // 1. 用内部 chunker 切块
    const chunks = this.innerChunker.chunk(document, options);
    if (chunks.length === 0) return [];

    // 2. 构建上下文信息
    const docTitle = (document.metadata['title'] as string) ?? '';
    const docSection = (document.metadata['section'] as string) ?? '';
    const fullContext = this.includeParentContext ? document.content : '';

    // 3. 为每个 chunk 生成 header
    const enrichedChunks: Chunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const header = await this.generateHeader(chunk.content, docTitle, docSection, fullContext);

      enrichedChunks.push({
        ...chunk,
        contextHeader: header,
        content: header + '\n' + chunk.content,
      });
    }

    return enrichedChunks;
  }

  /**
   * 用 LLM 生成 chunk 的上下文摘要
   *
   * @param chunkContent - chunk 内容
   * @param title - 文档标题
   * @param section - 文档章节
   * @param fullContext - 完整文档内容（用作上下文参考）
   * @returns 格式化后的 header 字符串
   */
  private async generateHeader(
    chunkContent: string,
    title: string,
    section: string,
    fullContext: string,
  ): Promise<string> {
    const contextSnippet = fullContext
      ? `\n文档全文（供参考上下文）：\n${fullContext.slice(0, 500)}`
      : '';

    const prompt = `请为以下文本片段生成一个简短的上下文摘要（1-2句话），说明这段内容在讲什么：

${chunkContent}
${contextSnippet}

只输出摘要，不要其他内容。`;

    try {
      const summary = await this.llm.chat([
        { role: 'system', content: '你是一个文档摘要助手。请生成简短的上下文摘要。' },
        { role: 'user', content: prompt },
      ]);

      return this.headerTemplate
        .replace('{summary}', summary.trim())
        .replace('{title}', title)
        .replace('{section}', section);
    } catch {
      // LLM 调用失败时返回基础 header
      return this.headerTemplate
        .replace('{summary}', '')
        .replace('{title}', title)
        .replace('{section}', section);
    }
  }
}
