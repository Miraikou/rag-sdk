import { describe, it, expect } from 'vitest';
import { ThresholdPostProcessor } from '../../src/post-process/threshold';
import type { SearchResult } from '@rag-sdk/core';

describe('ThresholdPostProcessor', () => {
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

  it('should filter results below threshold', async () => {
    const processor = new ThresholdPostProcessor({ threshold: 0.7 });
    const results = [
      makeResult('c1', 0.9),
      makeResult('c2', 0.5),
      makeResult('c3', 0.8),
    ];

    const filtered = await processor.process(results, 'test');
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.chunk.id).toBe('c1');
    expect(filtered[1]!.chunk.id).toBe('c3');
  });

  it('should return results sorted by score descending', async () => {
    const processor = new ThresholdPostProcessor({ threshold: 0 });
    const results = [
      makeResult('c1', 0.3),
      makeResult('c2', 0.9),
      makeResult('c3', 0.6),
    ];

    const filtered = await processor.process(results, 'test');
    expect(filtered[0]!.score).toBe(0.9);
    expect(filtered[1]!.score).toBe(0.6);
    expect(filtered[2]!.score).toBe(0.3);
  });

  it('should respect maxResults limit', async () => {
    const processor = new ThresholdPostProcessor({ threshold: 0, maxResults: 2 });
    const results = [
      makeResult('c1', 0.9),
      makeResult('c2', 0.8),
      makeResult('c3', 0.7),
    ];

    const filtered = await processor.process(results, 'test');
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.chunk.id).toBe('c1');
    expect(filtered[1]!.chunk.id).toBe('c2');
  });

  it('should return empty array when all results are below threshold', async () => {
    const processor = new ThresholdPostProcessor({ threshold: 0.95 });
    const results = [
      makeResult('c1', 0.5),
      makeResult('c2', 0.6),
    ];

    const filtered = await processor.process(results, 'test');
    expect(filtered).toHaveLength(0);
  });

  it('should handle empty input', async () => {
    const processor = new ThresholdPostProcessor();
    const filtered = await processor.process([], 'test');
    expect(filtered).toHaveLength(0);
  });
});
