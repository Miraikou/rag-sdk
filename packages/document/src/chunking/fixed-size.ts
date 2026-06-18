import type { Chunk, ChunkOptions, Document } from '@rag-sdk/core';
import { BaseChunker } from './base';

/**
 * 固定大小切块器
 *
 * 按字符数切分文档，支持重叠区域保证上下文连续性。
 * 优先在 separator 处断开，避免截断单词。
 */
export class FixedSizeChunker extends BaseChunker {
  chunk(document: Document, options?: ChunkOptions): Chunk[] {
    const { chunkSize, overlap, separator } = this.mergeOptions(options);
    const content = document.content;

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
