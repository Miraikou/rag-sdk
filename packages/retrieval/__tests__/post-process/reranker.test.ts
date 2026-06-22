import { describe, it, expect } from 'vitest';
import { RerankerPostProcessor } from '../../src/post-process/reranker';
import type { SearchResult } from '@rag-sdk/core';

const makeResult = (id: string, score: number): SearchResult => ({
  chunk: {
    id,
    documentId: 'doc-1',
    content: `content of ${id}`,
    metadata: {},
  },
  score,
  source: 'vector',
});

describe('RerankerPostProcessor', () => {
  it('should rerank results using scorer function', async () => {
    // 模拟交叉编码器：c2 得高分
    const scorer = async (_query: string, content: string): Promise<number> => {
      return content.includes('c2') ? 0.95 : 0.1;
    };

    const processor = new RerankerPostProcessor(scorer, { topK: 2 });
    const results = [
      makeResult('c1', 0.9),
      makeResult('c2', 0.5),
      makeResult('c3', 0.8),
    ];

    const reranked = await processor.process(results, 'TypeScript');

    expect(reranked).toHaveLength(2);
    // c2 被 scorer 打了高分，应该排第一
    expect(reranked[0]!.chunk.id).toBe('c2');
    expect(reranked[0]!.score).toBe(0.95);
  });

  it('should preserve original score in metadata', async () => {
    const scorer = async (): Promise<number> => 0.99;

    const processor = new RerankerPostProcessor(scorer);
    const results = [makeResult('c1', 0.7)];

    const reranked = await processor.process(results, 'test');

    expect(reranked[0]!.chunk.metadata['originalScore']).toBe(0.7);
    expect(reranked[0]!.chunk.metadata['rerankScore']).toBe(0.99);
  });

  it('should handle empty input', async () => {
    const scorer = async (): Promise<number> => 1;
    const processor = new RerankerPostProcessor(scorer);

    const reranked = await processor.process([], 'test');
    expect(reranked).toHaveLength(0);
  });

  it('should respect topK parameter', async () => {
    const scorer = async (_query: string, content: string): Promise<number> => {
      const idx = parseInt(content.match(/c(\d)/)?.[1] ?? '0', 10);
      return idx / 10;
    };

    const processor = new RerankerPostProcessor(scorer, { topK: 2 });
    const results = [
      makeResult('c1', 0.1),
      makeResult('c2', 0.2),
      makeResult('c3', 0.3),
      makeResult('c4', 0.4),
    ];

    const reranked = await processor.process(results, 'test');
    expect(reranked).toHaveLength(2);
  });
});
