import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BaseLoader } from './base';
import type { Document, MarkdownLoaderOptions } from '../types';

/**
 * Markdown 加载器
 *
 * 加载 Markdown 文件，保留标题层级结构。
 * 可选择将整个文件作为单个文档，或按顶级标题拆分为多个文档。
 */
export class MarkdownLoader extends BaseLoader {
  private readonly splitByHeading: boolean;
  private readonly headingLevel: 1 | 2 | 3;

  /**
   * @param options - 加载选项
   * @param options.splitByHeading - 是否按标题拆分为多个 Document，默认 false
   * @param options.headingLevel - 拆分依据的标题级别，默认 1
   */
  constructor(options?: MarkdownLoaderOptions) {
    super();
    this.splitByHeading = options?.splitByHeading ?? false;
    this.headingLevel = options?.headingLevel ?? 1;
  }

  /**
   * 加载 Markdown 文件
   *
   * @param source - 文件路径字符串或 Buffer
   * @returns 文档数组（splitByHeading 为 true 时可能包含多个文档）
   */
  async load(source: string | Buffer): Promise<Document[]> {
    const content = Buffer.isBuffer(source)
      ? source.toString('utf-8')
      : await readFile(resolve(source), 'utf-8');

    if (!this.splitByHeading) {
      return [
        {
          id: this.generateId(),
          content,
          metadata: {
            source: String(source),
            loader: 'MarkdownLoader',
            format: 'markdown',
          },
        },
      ];
    }

    // 按标题级别拆分
    const headingPrefix = '#'.repeat(this.headingLevel);
    const sections = this.splitByHeadingContent(content, headingPrefix);

    return sections.map((section) => ({
      id: this.generateId(),
      content: section.content,
      metadata: {
        source: String(source),
        loader: 'MarkdownLoader',
        format: 'markdown',
        heading: section.heading,
        sectionIndex: section.index,
      },
    }));
  }

  /**
   * 按标题级别拆分 Markdown 内容
   *
   * @param content - 完整 Markdown 文本
   * @param prefix - 标题前缀（如 '#' 或 '##'）
   * @returns 拆分后的章节数组
   */
  private splitByHeadingContent(
    content: string,
    prefix: string
  ): Array<{ content: string; heading: string; index: number }> {
    const regex = new RegExp(`^(${prefix}\\s+.+)$`, 'gm');
    const parts: Array<{ content: string; heading: string; index: number }> = [];
    const segments = content.split(regex);

    let index = 0;

    // 处理标题前的引导文本
    if (segments[0]?.trim()) {
      parts.push({
        content: segments[0].trim(),
        heading: '(preamble)',
        index: index++,
      });
    }

    // segments 交替为正文和标题
    for (let i = 1; i < segments.length; i += 2) {
      const heading = segments[i]?.trim() ?? '';
      const body = segments[i + 1] ?? '';
      parts.push({
        content: `${heading}\n${body}`.trim(),
        heading: heading.replace(prefix, '').trim(),
        index: index++,
      });
    }

    // 如果没有找到任何标题，返回整个内容
    if (parts.length === 0) {
      parts.push({
        content: content.trim(),
        heading: '(full)',
        index: 0,
      });
    }

    return parts;
  }
}
