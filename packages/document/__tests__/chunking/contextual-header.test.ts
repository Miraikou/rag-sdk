import { describe, it, expect } from 'vitest';
import { FixedSizeChunker } from '../../src/chunking/fixed-size';

describe('ContextualHeaderChunker', () => {
  it('should export ContextualHeaderChunker', async () => {
    const { ContextualHeaderChunker } = await import('../../src/chunking/contextual-header');
    expect(ContextualHeaderChunker).toBeDefined();
  });

  it('should create instance with options', async () => {
    const { ContextualHeaderChunker } = await import('../../src/chunking/contextual-header');
    const chunker = new ContextualHeaderChunker({
      llm: {
        chat: async () => 'summary',
        chatStream: async function* () { yield 'summary'; },
        chatJson: async () => ({}),
      },
      innerChunker: new FixedSizeChunker(),
    });
    expect(chunker).toBeDefined();
    expect(typeof chunker.chunk).toBe('function');
  });

  it('should chunk document with headers', async () => {
    const { ContextualHeaderChunker } = await import('../../src/chunking/contextual-header');
    const chunker = new ContextualHeaderChunker({
      llm: {
        chat: async () => 'summary of content',
        chatStream: async function* () { yield 'summary'; },
        chatJson: async () => ({}),
      },
      innerChunker: new FixedSizeChunker(),
    });
    const doc = {
      id: 'doc-1',
      content: '# 标题\n\n内容 1\n\n## 子标题\n\n内容 2',
      metadata: {},
    };
    const chunks = chunker.chunk(doc);
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((c) => {
      expect(c.documentId).toBe('doc-1');
    });
  });

  it('should handle document without headers', async () => {
    const { ContextualHeaderChunker } = await import('../../src/chunking/contextual-header');
    const chunker = new ContextualHeaderChunker({
      llm: {
        chat: async () => 'summary',
        chatStream: async function* () { yield 'summary'; },
        chatJson: async () => ({}),
      },
      innerChunker: new FixedSizeChunker(),
    });
    const doc = {
      id: 'doc-2',
      content: '这是没有标题的纯文本内容。',
      metadata: {},
    };
    const chunks = chunker.chunk(doc);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
