import { describe, it, expect, vi } from 'vitest';
import { FusionSearch } from '../../src/search/fusion';
import type { Retriever, SearchResult } from '@rag-sdk/core';

function createMockRetriever(results: SearchResult[]): Retriever {
  return {
    retrieve: vi.fn().mockResolvedValue(results),
  };
}

describe('FusionSearch', () => {
  it('should merge results with Min-Max normalized scores', async () => {
    // Vector: c1=0.9, c2=0.7 → 归一化: c1=1, c2=0
    const vectorResults: SearchResult[] = [
      { chunk: { id: 'c1', documentId: 'd1', content: 'vector match', metadata: {} }, score: 0.9, source: 'vector' },
      { chunk: { id: 'c2', documentId: 'd1', content: 'vector only', metadata: {} }, score: 0.7, source: 'vector' },
    ];

    // Keyword: c1=0.8, c3=0.6 → 归一化: c1=1, c3=0
    const keywordResults: SearchResult[] = [
      { chunk: { id: 'c1', documentId: 'd1', content: 'vector match', metadata: {} }, score: 0.8, source: 'keyword' },
      { chunk: { id: 'c3', documentId: 'd1', content: 'keyword only', metadata: {} }, score: 0.6, source: 'keyword' },
    ];

    const vector = createMockRetriever(vectorResults);
    const keyword = createMockRetriever(keywordResults);
    const fusion = new FusionSearch(vector, keyword, 0.6, 0.4);

    const results = await fusion.retrieve('test query', { topK: 5 });

    // c1 在两路都是最高分，归一化后都是 1
    // 合并分数: 1*0.6 + 1*0.4 = 1.0
    const c1 = results.find((r) => r.chunk.id === 'c1');
    expect(c1).toBeDefined();
    expect(c1!.score).toBeCloseTo(1.0, 5);
    expect(c1!.source).toBe('fusion');

    // c2 只在 vector 中出现，归一化后分数为 0
    // 合并分数: 0*0.6 = 0
    const c2 = results.find((r) => r.chunk.id === 'c2');
    expect(c2).toBeDefined();
    expect(c2!.score).toBeCloseTo(0, 5);
  });

  it('should call both retrievers in parallel', async () => {
    const vector = createMockRetriever([]);
    const keyword = createMockRetriever([]);
    const fusion = new FusionSearch(vector, keyword);

    await fusion.retrieve('test');

    expect(vector.retrieve).toHaveBeenCalledOnce();
    expect(keyword.retrieve).toHaveBeenCalledOnce();
  });

  it('should handle results from only one retriever', async () => {
    // 单个结果归一化为 1
    const vector = createMockRetriever([
      { chunk: { id: 'c1', documentId: 'd1', content: 'test', metadata: {} }, score: 0.9, source: 'vector' },
    ]);
    const keyword = createMockRetriever([]);
    const fusion = new FusionSearch(vector, keyword, 0.5, 0.5);

    const results = await fusion.retrieve('test');
    expect(results).toHaveLength(1);
    // 单结果归一化为 1，再乘以权重: 1*0.5 = 0.5
    expect(results[0]!.score).toBeCloseTo(0.5, 5);
  });

  it('should respect topK parameter', async () => {
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      chunk: { id: `c${i}`, documentId: 'd1', content: `content ${i}`, metadata: {} },
      score: 1 - i * 0.05,
      source: 'vector' as const,
    }));

    const vector = createMockRetriever(manyResults);
    const keyword = createMockRetriever([]);
    const fusion = new FusionSearch(vector, keyword);

    const results = await fusion.retrieve('test', { topK: 3 });
    expect(results).toHaveLength(3);
  });

  it('should handle same scores (all normalized to 0.5)', async () => {
    // 所有分数相同，归一化为 0.5
    const vectorResults: SearchResult[] = [
      { chunk: { id: 'c1', documentId: 'd1', content: 'same', metadata: {} }, score: 0.8, source: 'vector' },
      { chunk: { id: 'c2', documentId: 'd1', content: 'same', metadata: {} }, score: 0.8, source: 'vector' },
    ];

    const vector = createMockRetriever(vectorResults);
    const keyword = createMockRetriever([]);
    const fusion = new FusionSearch(vector, keyword, 0.5, 0.5);

    const results = await fusion.retrieve('test');
    // 所有分数相同，归一化为 0.5，再乘权重: 0.5*0.5 = 0.25
    expect(results[0]!.score).toBeCloseTo(0.25, 5);
    expect(results[1]!.score).toBeCloseTo(0.25, 5);
  });
});
