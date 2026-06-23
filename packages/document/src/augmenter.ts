import { z } from 'zod';
import type { Document, LLMProvider, Message, AugmentOptions, QAPair } from './types';

/** 关键词提取的 Zod schema */
const KeywordsSchema = z.object({
  keywords: z.array(z.string()).describe('提取的关键词列表，5-8 个'),
}).describe('从文本中提取的关键词');

/** QA 对生成的 Zod schema */
const QAPairsSchema = z.object({
  qaPairs: z.array(z.object({
    question: z.string().describe('基于文本内容可能被问到的问题'),
    answer: z.string().describe('能从文本中直接找到依据的答案'),
  })).describe('生成的问答对列表'),
}).describe('基于文本生成的问答对');

/**
 * 文档增强器
 *
 * 利用 LLM 为文档生成附加内容（摘要、关键词、QA 对），
 * 增强文档的可检索性和信息密度。
 *
 * QA 对增强特别有效——为文档生成可能的提问和回答，
 * 使用户的自然语言问题能直接匹配到预生成的 QA 对。
 */
export class DocumentAugmenter {
  private readonly llmProvider: LLMProvider;

  /**
   * @param llmProvider - LLM 提供商
   */
  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * 增强单个文档
   *
   * @param document - 待增强的文档
   * @param options - 增强选项
   * @returns 增强后的文档
   */
  async augmentDocument(document: Document, options?: AugmentOptions): Promise<Document> {
    const opts: Required<AugmentOptions> = {
      generateSummary: options?.generateSummary ?? true,
      generateKeywords: options?.generateKeywords ?? true,
      generateQA: options?.generateQA ?? false,
      qaPairCount: options?.qaPairCount ?? 3,
    };

    const augmentedMetadata: Record<string, unknown> = {};
    const augmentedParts: string[] = [];

    if (opts.generateSummary) {
      const summary = await this.generateSummary(document);
      augmentedMetadata['summary'] = summary;
      augmentedParts.push(`[摘要] ${summary}`);
    }

    if (opts.generateKeywords) {
      const keywords = await this.generateKeywords(document);
      augmentedMetadata['keywords'] = keywords;
      augmentedParts.push(`[关键词] ${keywords.join(', ')}`);
    }

    if (opts.generateQA) {
      const qaPairs = await this.generateQA(document, opts.qaPairCount);
      augmentedMetadata['qaPairs'] = qaPairs;
      for (const qa of qaPairs) {
        augmentedParts.push(`[Q] ${qa.question}\n[A] ${qa.answer}`);
      }
    }

    // 将增强内容附加到文档末尾
    const augmentedContent = document.content + '\n\n---\n' + augmentedParts.join('\n\n');

    return {
      ...document,
      content: augmentedContent,
      metadata: {
        ...document.metadata,
        ...augmentedMetadata,
        augmented: true,
        augmentedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 批量增强文档（兼容 IndexingPipeline 接口）
   *
   * @param documents - 待增强的文档数组
   * @returns 增强后的文档数组
   */
  async augment(documents: Document[]): Promise<Document[]> {
    const results: Document[] = [];
    for (const doc of documents) {
      results.push(await this.augmentDocument(doc));
    }
    return results;
  }

  /**
   * 生成文档摘要（纯文本输出，使用 chat）
   */
  private async generateSummary(document: Document): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: '请用2-3句话概括以下文本的核心内容，要求简洁准确。',
      },
      { role: 'user', content: document.content.slice(0, 3000) },
    ];

    return this.llmProvider.chat(messages, { maxTokens: 200, temperature: 0 });
  }

  /**
   * 生成关键词列表（使用 chatJson 结构化输出）
   */
  private async generateKeywords(document: Document): Promise<string[]> {
    const messages: Message[] = [
      {
        role: 'system',
        content: '请提取以下文本的5-8个关键词。',
      },
      { role: 'user', content: document.content.slice(0, 2000) },
    ];

    try {
      const schema = z.toJSONSchema(KeywordsSchema);
      const result = await this.llmProvider.chatJson<{ keywords: string[] }>(
        messages,
        schema,
        { maxTokens: 100, temperature: 0 },
      );
      return result.keywords;
    } catch {
      return [];
    }
  }

  /**
   * 生成 QA 对（使用 chatJson 结构化输出）
   */
  private async generateQA(document: Document, count: number): Promise<QAPair[]> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `基于以下文本，生成 ${count} 个可能被问到的问题及其答案。
问题应该自然、具体，答案应该能从文本中直接找到依据。`,
      },
      { role: 'user', content: document.content.slice(0, 3000) },
    ];

    try {
      const schema = z.toJSONSchema(QAPairsSchema);
      const result = await this.llmProvider.chatJson<{ qaPairs: QAPair[] }>(
        messages,
        schema,
        { maxTokens: 500, temperature: 0.3 },
      );
      return result.qaPairs;
    } catch {
      return [];
    }
  }
}
