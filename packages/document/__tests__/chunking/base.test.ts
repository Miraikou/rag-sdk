import { describe, it, expect } from 'vitest';
import { BaseChunker } from '../../src/chunking/base';
import type { Document, Chunk, ChunkOptions } from '@ragsdk/core';

// 具体实现用于测试抽象基类
class TestChunker extends BaseChunker {
  chunk(document: Document, options?: ChunkOptions): Chunk[] {
    if (!document.content) return [];
    const size = options?.chunkSize ?? 100;
    const chunks: Chunk[] = [];
    for (let i = 0; i < document.content.length; i += size) {
      chunks.push({
        id: `${document.id}-chunk-${i}`,
        documentId: document.id,
        content: document.content.slice(i, i + size),
        metadata: { ...document.metadata },
      });
    }
    return chunks;
  }
}

describe('BaseChunker', () => {
  const chunker = new TestChunker();

  it('should return empty array for empty document', () => {
    const chunks = chunker.chunk({ id: 'doc-1', content: '', metadata: {} });
    expect(chunks).toHaveLength(0);
  });

  it('should return single chunk for short document', () => {
    const chunks = chunker.chunk({
      id: 'doc-1',
      content: 'Hello world',
      metadata: {},
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe('Hello world');
    expect(chunks[0]!.documentId).toBe('doc-1');
  });

  it('should split long content into chunks', () => {
    const content = 'a'.repeat(250);
    const chunks = chunker.chunk(
      { id: 'doc-1', content, metadata: { title: 'Test' } },
      { chunkSize: 100 },
    );
    expect(chunks.length).toBe(3);
    chunks.forEach((c) => {
      expect(c.documentId).toBe('doc-1');
      expect(c.metadata).toHaveProperty('title', 'Test');
    });
  });

  it('should use default chunkSize', () => {
    const content = 'a'.repeat(150);
    const chunks = chunker.chunk({ id: 'doc-1', content, metadata: {} });
    expect(chunks.length).toBe(2);
  });
});
