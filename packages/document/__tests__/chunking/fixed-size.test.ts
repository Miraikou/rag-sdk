import { describe, it, expect } from 'vitest';
import { FixedSizeChunker } from '../../src/chunking/fixed-size';
import type { Document } from '@rag-sdk/core';

describe('FixedSizeChunker', () => {
  const chunker = new FixedSizeChunker();
  const makeDoc = (content: string): Document => ({
    id: 'doc-1',
    content,
    metadata: {},
  });

  it('should return empty array for empty document', () => {
    const chunks = chunker.chunk(makeDoc(''));
    expect(chunks).toHaveLength(0);
  });

  it('should return single chunk for short document', () => {
    const chunks = chunker.chunk(makeDoc('Hello world'));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe('Hello world');
  });

  it('should split long document into multiple chunks', () => {
    const content = 'a'.repeat(1200);
    const chunks = chunker.chunk(makeDoc(content), { chunkSize: 500, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.documentId).toBe('doc-1');
      expect(chunk.content.length).toBeLessThanOrEqual(500);
    });
  });

  it('should throw on invalid chunkSize', () => {
    expect(() => chunker.chunk(makeDoc('test'), { chunkSize: 0 })).toThrow();
    expect(() => chunker.chunk(makeDoc('test'), { chunkSize: -1 })).toThrow();
  });

  it('should throw when overlap >= chunkSize', () => {
    expect(() => chunker.chunk(makeDoc('test'), { chunkSize: 100, overlap: 100 })).toThrow();
    expect(() => chunker.chunk(makeDoc('test'), { chunkSize: 100, overlap: 150 })).toThrow();
  });
});
