import type { Chunk, ChunkOptions, Document } from '@rag-sdk/core';
import { BaseChunker } from './base';

/**
 * 固定大小切块器
 *
 * 按字符数切分文档，支持重叠区域保证上下文连续性。
 * 优先在 separator 处断开，避免截断单词。
 */
export class FixedSizeChunker extends BaseChunker {
  /**
   * 按固定大小切分文档
   *
   * 优先在 separator 处断开，避免截断单词。支持 overlap 重叠区域。
   *
   * @param document - 待切分的文档
   * @param options - 切块选项（chunkSize、overlap、separator）
   * @returns 切分后的 chunk 数组
   */
  chunk(document: Document, options?: ChunkOptions): Chunk[] {
    const { chunkSize, overlap, separator } = this.mergeOptions(options);

    // 参数校验
    if (chunkSize <= 0) throw new Error(`chunkSize must be positive, got ${chunkSize}`);
    if (overlap < 0) throw new Error(`overlap must be non-negative, got ${overlap}`);
    if (overlap >= chunkSize) throw new Error(`overlap (${overlap}) must be less than chunkSize (${chunkSize})`);

    const content = document.content;

    // 空文档返回空数组
    if (!content.trim()) return [];

    if (content.length <= chunkSize) {
      return [
        {
          id: this.generateChunkId(document.id, 0),
          documentId: document.id,
          content: content.trim(),
          metadata: { ...document.metadata, chunkIndex: 0 },
        },
      ];
    }

    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;

    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);

      let chunkText: string;

      if (end >= content.length) {
        // 最后一段，直接取到结尾
        chunkText = content.slice(start).trim();
      } else {
        // 尝试在 separator 处断开
        const slice = content.slice(start, end);
        const lastSepIndex = slice.lastIndexOf(separator);

        if (lastSepIndex > chunkSize * 0.5) {
          // separator 在合理位置（超过一半处），在此断开
          chunkText = slice.slice(0, lastSepIndex).trim();
        } else {
          // 找不到合适的 separator，在空格处断开
          const lastSpaceIndex = slice.lastIndexOf(' ');
          if (lastSpaceIndex > chunkSize * 0.5) {
            chunkText = slice.slice(0, lastSpaceIndex).trim();
          } else {
            chunkText = slice.trim();
          }
        }
      }

      if (chunkText.length > 0) {
        chunks.push({
          id: this.generateChunkId(document.id, index),
          documentId: document.id,
          content: chunkText,
          metadata: { ...document.metadata, chunkIndex: index },
        });
        index++;
      }

      // 下一段从当前结束位置 - overlap 开始
      const advance = chunkText.length - overlap;
      start += advance > 0 ? advance : 1;
    }

    return chunks;
  }
}
