import { describe, it, expect } from 'vitest';

describe('RecursiveChunker', () => {
  it('should export RecursiveChunker', async () => {
    const { RecursiveChunker } = await import('../../src/chunking/recursive');
    expect(RecursiveChunker).toBeDefined();
  });

  it('should create instance', async () => {
    const { RecursiveChunker } = await import('../../src/chunking/recursive');
    const chunker = new RecursiveChunker();
    expect(chunker).toBeDefined();
    expect(typeof chunker.chunk).toBe('function');
  });

  it('should return single chunk for short content', async () => {
    const { RecursiveChunker } = await import('../../src/chunking/recursive');
    const chunker = new RecursiveChunker();
    const chunks = chunker.chunk({
      id: 'doc-1',
      content: 'Hello world',
      metadata: {},
    });
    expect(chunks).toHaveLength(1);
  });

  it('should split long content recursively at paragraph boundaries', async () => {
    const { RecursiveChunker } = await import('../../src/chunking/recursive');
    const chunker = new RecursiveChunker();
    const content = 'A'.repeat(50) + '\n\n' + 'B'.repeat(50) + '\n\n' + 'C'.repeat(50);
    const chunks = chunker.chunk(
      { id: 'doc-1', content, metadata: {} },
      { chunkSize: 60, overlap: 10 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => {
      expect(c.documentId).toBe('doc-1');
    });
  });

  it('should produce chunks that stay within chunkSize', async () => {
    const { RecursiveChunker } = await import('../../src/chunking/recursive');
    const chunker = new RecursiveChunker();
    // 使用短段落，每个段落不超过 chunkSize
    const paragraphs: string[] = [];
    for (let i = 0; i < 6; i++) {
      paragraphs.push(`P${i}: ${'x'.repeat(20)}`);
    }
    const content = paragraphs.join('\n\n');
    const chunks = chunker.chunk(
      { id: 'doc-1', content, metadata: {} },
      { chunkSize: 100, overlap: 10 },
    );
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((c) => {
      expect(c.content.length).toBeLessThanOrEqual(100);
    });
  });
});
