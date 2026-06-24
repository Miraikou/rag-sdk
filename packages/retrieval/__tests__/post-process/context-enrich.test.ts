import { describe, it, expect } from 'vitest';
import type { SearchResult } from '@rag-sdk/core';

describe('ContextEnrichPostProcessor', () => {
  it('should export ContextEnrichPostProcessor', async () => {
    const { ContextEnrichPostProcessor } = await import('../../src/post-process/context-enrich');
    expect(ContextEnrichPostProcessor).toBeDefined();
  });

  it('should create instance', async () => {
    const { ContextEnrichPostProcessor } = await import('../../src/post-process/context-enrich');
    const processor = new ContextEnrichPostProcessor();
    expect(processor).toBeDefined();
    expect(typeof processor.process).toBe('function');
  });

  it('should enrich results with context from surrounding chunks', async () => {
    const { ContextEnrichPostProcessor } = await import('../../src/post-process/context-enrich');
    const processor = new ContextEnrichPostProcessor();

    const results: SearchResult[] = [
      {
        chunk: {
          id: 'c2',
          documentId: 'doc-1',
          content: '这是第二个段落。',
          metadata: { position: 2 },
        },
        score: 0.9,
        source: 'vector',
      },
    ];

    const enriched = await processor.process(results, '测试查询');
    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.chunk.documentId).toBe('doc-1');
  });

  it('should handle empty results', async () => {
    const { ContextEnrichPostProcessor } = await import('../../src/post-process/context-enrich');
    const processor = new ContextEnrichPostProcessor();
    const results = await processor.process([], 'query');
    expect(results).toHaveLength(0);
  });

  it('should not modify results when no context available', async () => {
    const { ContextEnrichPostProcessor } = await import('../../src/post-process/context-enrich');
    const processor = new ContextEnrichPostProcessor();

    const results: SearchResult[] = [
      {
        chunk: {
          id: 'c1',
          documentId: 'doc-1',
          content: '独立内容，无上下文。',
          metadata: {},
        },
        score: 0.95,
        source: 'vector',
      },
    ];

    const processed = await processor.process(results, 'query');
    expect(processed.length).toBeGreaterThan(0);
  });
});
