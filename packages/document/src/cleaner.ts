import type { Document, CleanerOptions } from './types';

/**
 * 文档清洗器
 *
 * 对文档进行预处理，去除噪音内容（HTML 标签、多余空白、页眉页脚、特殊字符），
 * 统一编码格式。清洗后的文档内容更干净，切块和检索的质量更高。
 */
export class DocumentCleaner {
  private readonly removeHtml: boolean;
  private readonly removeExtraWhitespace: boolean;
  private readonly removeHeaderFooter: boolean;
  private readonly removeSpecialChars: boolean;

  /**
   * @param options - 清洗选项
   * @param options.removeHtml - 去除 HTML 标签，默认 true
   * @param options.removeExtraWhitespace - 合并多余空白，默认 true
   * @param options.removeHeaderFooter - 去除页眉页脚，默认 false
   * @param options.removeSpecialChars - 去除特殊字符，默认 false
   */
  constructor(options?: CleanerOptions) {
    this.removeHtml = options?.removeHtml ?? true;
    this.removeExtraWhitespace = options?.removeExtraWhitespace ?? true;
    this.removeHeaderFooter = options?.removeHeaderFooter ?? false;
    this.removeSpecialChars = options?.removeSpecialChars ?? false;
  }

  /**
   * 清洗单个文档
   *
   * @param document - 待清洗的文档
   * @returns 清洗后的文档
   */
  cleanDocument(document: Document): Document {
    let content = document.content;

    if (this.removeHtml) {
      content = this.stripHtml(content);
    }

    if (this.removeHeaderFooter) {
      content = this.stripHeaderFooter(content);
    }

    if (this.removeSpecialChars) {
      content = this.stripSpecialChars(content);
    }

    if (this.removeExtraWhitespace) {
      content = this.normalizeWhitespace(content);
    }

    return {
      ...document,
      content,
      metadata: {
        ...document.metadata,
        cleaned: true,
        cleanedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * 批量清洗文档（兼容 IndexingPipeline 接口）
   *
   * @param documents - 待清洗的文档数组
   * @returns 清洗后的文档数组
   */
  async clean(documents: Document[]): Promise<Document[]> {
    return documents.map((doc) => this.cleanDocument(doc));
  }

  /**
   * 去除 HTML 标签和常见 HTML 实体
   */
  private stripHtml(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }

  /**
   * 去除页眉页脚
   *
   * 检测重复出现的短行（出现次数 >= 总行数的 10%），将其视为页眉页脚并移除。
   */
  private stripHeaderFooter(text: string): string {
    const lines = text.split('\n');
    if (lines.length < 10) return text;

    const lineFrequency = new Map<string, number>();
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && trimmed.length < 80) {
        lineFrequency.set(trimmed, (lineFrequency.get(trimmed) ?? 0) + 1);
      }
    }

    const threshold = Math.max(3, lines.length * 0.1);
    const headerFooterLines = new Set<string>();
    for (const [line, count] of lineFrequency) {
      if (count >= threshold) {
        headerFooterLines.add(line);
      }
    }

    return lines
      .filter((line) => !headerFooterLines.has(line.trim()))
      .join('\n');
  }

  /**
   * 去除非常规特殊字符
   *
   * 仅保留中文、英文、数字和基本标点符号。
   */
  private stripSpecialChars(text: string): string {
    return text.replace(
      /[^一-龥a-zA-Z0-9\s.,;:!?"'()\[\]{}。，；：！？""''（）【】-]/g,
      ''
    );
  }

  /**
   * 标准化空白字符
   *
   * 合并连续空格为单空格，合并连续空行为双换行。
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
