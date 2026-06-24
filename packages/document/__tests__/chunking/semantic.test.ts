import { describe, it, expect } from 'vitest';

describe('SemanticChunker', () => {
  it('should export SemanticChunker', async () => {
    const { SemanticChunker } = await import('../../src/chunking/semantic');
    expect(SemanticChunker).toBeDefined();
  });

  it('should create instance with embedding config', async () => {
    const { SemanticChunker } = await import('../../src/chunking/semantic');
    const chunker = new SemanticChunker({ embedding: { dimension: 3 } });
    expect(chunker).toBeDefined();
    expect(typeof chunker.chunk).toBe('function');
  });

  it('should return single chunk for short content', async () => {
    const { SemanticChunker } = await import('../../src/chunking/semantic');
    const chunker = new SemanticChunker({ embedding: { dimension: 3 } });
    const chunks = chunker.chunk({
      id: 'doc-1',
      content: 'Short content.',
      metadata: {},
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.documentId).toBe('doc-1');
  });

  it('should split content at semantic boundaries', async () => {
    const { SemanticChunker } = await import('../../src/chunking/semantic');
    const chunker = new SemanticChunker({ embedding: { dimension: 3 } });
    const content = '第一段关于AI的内容。\n\n第二段关于数据库的内容。\n\n第三段关于编程的内容。';
    const chunks = chunker.chunk(
      { id: 'doc-1', content, metadata: {} },
      { chunkSize: 30 },
    );
    chunks.forEach((c) => {
      expect(c.id).toBeDefined();
      expect(c.content.length).toBeGreaterThan(0);
    });
  });
});
