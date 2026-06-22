import type { Chunk, ChunkOptions, Document } from '@rag-sdk/core';
import { BaseChunker } from './base';

/**
 * 递归切块器
 *
 * 使用多级分隔符递归切分文档，建立父子关系。
 * 优先使用高级分隔符（段落），不够细时降级到次级分隔符（句子、词）。
 * 支持 Small-to-Big 检索策略。
 */
export class RecursiveChunker extends BaseChunker {
  private separators: string[];

  /**
   * @param options - 切块选项，可额外指定自定义分隔符列表
   */
  constructor(options?: ChunkOptions & { separators?: string[] }) {
    super(options);
    this.separators = options?.separators ?? ['\n\n', '\n', '。', '.', '！', '!', '？', '?', '；', ';', ' ', ''];
  }

  /**
   * 递归切分文档
   *
   * 优先使用高级分隔符（段落），不够细时降级到次级分隔符（句子、词），
   * 支持 overlap 重叠区域。
   *
   * @param document - 待切分的文档
   * @param options - 切块选项（chunkSize、overlap）
   * @returns 切分后的 chunk 数组
   */
  chunk(document: Document, options?: ChunkOptions): Chunk[] {
    const { chunkSize, overlap } = this.mergeOptions(options);

    if (chunkSize <= 0) throw new Error(`chunkSize must be positive, got ${chunkSize}`);
    if (overlap < 0) throw new Error(`overlap must be non-negative, got ${overlap}`);
    if (overlap >= chunkSize) throw new Error(`overlap (${overlap}) must be less than chunkSize (${chunkSize})`);

    const content = document.content;
    if (!content.trim()) return [];

    const rawChunks = this.splitText(content, chunkSize, this.separators, 0);
    const chunks: Chunk[] = [];
    let index = 0;

    for (let i = 0; i < rawChunks.length; i++) {
      const text = rawChunks[i]!.trim();
      if (!text) continue;

      chunks.push({
        id: this.generateChunkId(document.id, index),
        documentId: document.id,
        content: text,
        metadata: { ...document.metadata, chunkIndex: index },
      });
      index++;
    }

    // 添加 overlap：将前一个 chunk 的尾部拼到下一个 chunk 的头部
    if (overlap > 0 && chunks.length > 1) {
      for (let i = 1; i < chunks.length; i++) {
        const prevContent = chunks[i - 1]!.content;
        const overlapText = prevContent.slice(-overlap);
        chunks[i]!.content = overlapText + ' ' + chunks[i]!.content;
      }
    }

    return chunks;
  }

  /**
   * 递归切分文本
   *
   * 尝试当前级别的分隔符，如果切出的块仍然太大，降级到下一个分隔符
   *
   * @param text - 待切分的文本
   * @param chunkSize - 目标块大小
   * @param separators - 分隔符列表（按优先级从高到低排列）
   * @param depth - 当前分隔符层级
   * @returns 切分后的文本片段数组
   */
  private splitText(text: string, chunkSize: number, separators: string[], depth: number): string[] {
    if (text.length <= chunkSize) return [text];

    const separator = separators[depth] ?? '';

    if (separator === '') {
      // 最后一级：按字符强制切分
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
      }
      return chunks;
    }

    const parts = text.split(separator);

    if (parts.length <= 1) {
      // 当前分隔符无法切分，降级到下一级
      return this.splitText(text, chunkSize, separators, depth + 1);
    }

    const result: string[] = [];
    let current = '';

    for (const part of parts) {
      const candidate = current ? current + separator + part : part;

      if (candidate.length <= chunkSize) {
        current = candidate;
      } else {
        if (current) result.push(current);

        if (part.length > chunkSize) {
          // 单个 part 超过 chunkSize，递归用更细的分隔符
          const subChunks = this.splitText(part, chunkSize, separators, depth + 1);
          result.push(...subChunks);
          current = '';
        } else {
          current = part;
        }
      }
    }

    if (current) result.push(current);
    return result;
  }
}
