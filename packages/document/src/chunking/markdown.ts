import type { Chunk, Document } from '@ragsdk/core';
import { BaseChunker } from './base';
import type { MarkdownChunkOptions } from '../types';

/** Markdown 标题块 */
interface HeadingBlock {
  level: number;
  heading: string;
  content: string;
}

/**
 * Markdown 切块器
 *
 * 按 Markdown 标题层级（h1-h6）智能切块。
 * 每个 chunk 保留其所属标题路径作为上下文信息。
 * 当单个章节超过 chunkSize 时，自动按段落二次切分。
 */
export class MarkdownChunker extends BaseChunker {
  private readonly maxHeadingLevel: number;
  private readonly includeHeadings: boolean;

  /**
   * @param options - Markdown 切块选项
   * @param options.maxHeadingLevel - 最大标题切分层级（1-6），默认 2
   * @param options.chunkSize - 目标块大小（字符数），默认 500
   * @param options.includeHeadings - 是否保留标题行在 chunk 内容中，默认 true
   */
  constructor(options?: MarkdownChunkOptions) {
    super({ chunkSize: options?.chunkSize ?? 500 });
    this.maxHeadingLevel = options?.maxHeadingLevel ?? 2;
    this.includeHeadings = options?.includeHeadings ?? true;
  }

  /**
   * 按 Markdown 标题层级切分文档
   *
   * @param document - 待切分的 Markdown 文档
   * @returns 切分后的 chunk 数组
   */
  chunk(document: Document): Chunk[] {
    const content = document.content;
    if (!content.trim()) return [];

    // 1. 按标题拆分章节
    const blocks = this.splitByHeadings(content);

    // 2. 为每个章节生成 chunk（超长章节二次切分）
    const chunks: Chunk[] = [];
    let index = 0;

    for (const block of blocks) {
      if (block.content.length <= this.defaultChunkSize) {
        const chunkContent = this.includeHeadings && block.heading
          ? `${'#'.repeat(block.level)} ${block.heading}\n${block.content}`
          : block.content;

        chunks.push({
          id: this.generateChunkId(document.id, index),
          documentId: document.id,
          content: chunkContent.trim(),
          metadata: {
            ...document.metadata,
            chunkIndex: index,
            heading: block.heading,
            headingLevel: block.level,
          },
        });
        index++;
      } else {
        // 超长章节按段落二次切分
        const subChunks = this.splitLongBlock(block);
        for (const sub of subChunks) {
          const prefix = this.includeHeadings && block.heading
            ? `${'#'.repeat(block.level)} ${block.heading}\n`
            : '';

          chunks.push({
            id: this.generateChunkId(document.id, index),
            documentId: document.id,
            content: (prefix + sub).trim(),
            metadata: {
              ...document.metadata,
              chunkIndex: index,
              heading: block.heading,
              headingLevel: block.level,
            },
          });
          index++;
        }
      }
    }

    return chunks;
  }

  /**
   * 按标题层级拆分文档为章节块
   */
  private splitByHeadings(content: string): HeadingBlock[] {
    const lines = content.split('\n');
    const blocks: HeadingBlock[] = [];

    let currentLevel = 0;
    let currentHeading = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1]!.length;

        // 只处理在 maxHeadingLevel 范围内的标题
        if (level <= this.maxHeadingLevel) {
          // 保存前一个章节（跳过空内容的前导块）
          if (currentContent.length > 0) {
            blocks.push({
              level: currentLevel,
              heading: currentHeading,
              content: currentContent.join('\n').trim(),
            });
          }

          currentLevel = level;
          currentHeading = headingMatch[2]!.trim();
          currentContent = [];
        } else {
          // 超出范围的标题作为普通内容保留
          currentContent.push(line);
        }
      } else {
        currentContent.push(line);
      }
    }

    // 保存最后一个章节
    if (currentContent.length > 0 || blocks.length === 0) {
      blocks.push({
        level: currentLevel,
        heading: currentHeading,
        content: currentContent.join('\n').trim(),
      });
    }

    // 过滤空块（但保留第一个，即使为空）
    return blocks.filter((block, i) => i === 0 || block.content.trim().length > 0);
  }

  /**
   * 按段落切分超长章节块
   */
  private splitLongBlock(block: HeadingBlock): string[] {
    const paragraphs = block.content.split(/\n\s*\n/);
    const result: string[] = [];
    let current = '';

    for (const paragraph of paragraphs) {
      if (current.length + paragraph.length + 2 > this.defaultChunkSize && current) {
        result.push(current.trim());
        current = '';
      }
      current += (current ? '\n\n' : '') + paragraph;
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }
}
