import { z } from 'zod';
import type { Document, LLMProvider, Message, ExtractionOptions } from './types';

/** 高级元数据提取的 Zod schema */
const AdvancedMetadataSchema = z.object({
  topic: z.string().describe('主题分类'),
  keywords: z.array(z.string()).describe('关键词列表'),
  summary: z.string().describe('一句话摘要，不超过100字'),
}).describe('文档分析结果：主题分类、关键词和摘要');

/**
 * 元数据抽取器
 *
 * 自动为文档补充结构化元数据。
 * - **基础元数据**（规则提取）：标题、语言、字数、行数
 * - **高级元数据**（LLM 提取）：主题分类、关键词、摘要
 */
export class MetadataExtractor {
  private readonly llmProvider: LLMProvider | null;

  /**
   * @param llmProvider - LLM 提供商（高级提取时必需）
   */
  constructor(llmProvider?: LLMProvider) {
    this.llmProvider = llmProvider ?? null;
  }

  /**
   * 抽取单个文档的元数据
   *
   * @param document - 待处理的文档
   * @param options - 抽取选项
   * @returns 补充了元数据的文档
   */
  async extractDocument(document: Document, options?: ExtractionOptions): Promise<Document> {
    const useLLM = options?.useLLM ?? false;

    // 基础元数据（规则提取）
    const baseMetadata = this.extractBaseMetadata(document);

    // 高级元数据（LLM 提取）
    let advancedMetadata: Record<string, unknown> = {};
    if (useLLM && this.llmProvider) {
      advancedMetadata = await this.extractAdvancedMetadata(document, options);
    }

    return {
      ...document,
      metadata: {
        ...document.metadata,
        ...baseMetadata,
        ...advancedMetadata,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 批量抽取文档元数据（兼容 IndexingPipeline 接口）
   *
   * @param documents - 待处理的文档数组
   * @returns 补充了元数据的文档数组
   */
  async extract(documents: Document[]): Promise<Document[]> {
    const results: Document[] = [];
    for (const doc of documents) {
      results.push(await this.extractDocument(doc));
    }
    return results;
  }

  /**
   * 基于规则提取基础元数据
   */
  private extractBaseMetadata(document: Document): Record<string, unknown> {
    const content = document.content;

    return {
      title: this.extractTitle(content),
      language: this.detectLanguage(content),
      charCount: content.length,
      wordCount: this.countWords(content),
      lineCount: content.split('\n').length,
    };
  }

  /**
   * 提取标题：取第一个非空行，去除 Markdown 标题前缀
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        return trimmed.replace(/^#+\s*/, '');
      }
    }
    return '未命名';
  }

  /**
   * 简单语言检测：统计中英文字符比例
   */
  private detectLanguage(content: string): string {
    const chineseChars = (content.match(/[一-鿿]/g) ?? []).length;
    const englishChars = (content.match(/[a-zA-Z]/g) ?? []).length;
    const total = chineseChars + englishChars;

    if (total === 0) return 'unknown';
    if (chineseChars / total > 0.3) return 'zh';
    return 'en';
  }

  /**
   * 字数统计：中文按字计算，英文按词计算
   */
  private countWords(content: string): number {
    const chinese = (content.match(/[一-鿿]/g) ?? []).length;
    const english = (content.match(/[a-zA-Z]+/g) ?? []).length;
    return chinese + english;
  }

  /**
   * 使用 LLM 提取高级元数据（使用 chatJson 结构化输出）
   */
  private async extractAdvancedMetadata(
    document: Document,
    options?: ExtractionOptions
  ): Promise<Record<string, unknown>> {
    const maxKeywords = options?.maxKeywords ?? 5;
    const categories = options?.categories ?? ['技术', '商业', '科学', '教育', '其他'];

    const truncatedContent = document.content.slice(0, 2000);

    const messages: Message[] = [
      {
        role: 'system',
        content: `你是一个文档分析助手。请分析以下文本并提取：
1. topic: 主题分类（从以下类别中选择：${categories.join('、')}）
2. keywords: 关键词列表（最多 ${maxKeywords} 个）
3. summary: 一句话摘要（不超过100字）`,
      },
      {
        role: 'user',
        content: truncatedContent,
      },
    ];

    try {
      const schema = z.toJSONSchema(AdvancedMetadataSchema);
      const result = await this.llmProvider!.chatJson<{
        topic: string;
        keywords: string[];
        summary: string;
      }>(messages, schema, { maxTokens: 300, temperature: 0 });

      return {
        topic: result.topic,
        keywords: result.keywords,
        summary: result.summary,
      };
    } catch {
      return {
        topic: '提取失败',
        keywords: [],
        summary: '',
      };
    }
  }
}
