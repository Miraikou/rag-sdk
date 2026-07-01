import { describe, it, expect } from 'vitest';
import { RRFSearch } from '../../src/search/rrf';
import type { SearchResult } from '@ragsdk/core';

const makeResult = (id: string, score: number, source: 'vector' | 'keyword' = 'vector'): SearchResult => ({
  chunk: {
    id,
    documentId: 'doc-1',
    content: `content of ${id}`,
    metadata: {},
  },
  score,
  source,
});

describe('RRFSearch', () => {
  it('should fuse results from multiple retrievers using RRF', async () => {
    const set1: SearchResult[] = [
      makeResult('a', 0.9),
      makeResult('b', 0.8),
      makeResult('c', 0.7),
    ];

    const set2: SearchResult[] = [
      makeResult('b', 0.95),
      makeResult('a', 0.85),
      makeResult('d', 0.75),
    ];

    const rrf = new RRFSearch();
    const results = rrf.fuse([set1, set2], 4);

    // a: rank 1 in set1 + rank 2 in set2 => 1/(60+1) + 1/(60+2)
    // b: rank 2 in set1 + rank 1 in set2 => 1/(60+2) + 1/(60+1)
    // a and b have equal RRF scores, both should be in top results
    expect(results.length).toBeLessThanOrEqual(4);
    expect(results.length).toBeGreaterThan(0);

    const ids = results.map((r) => r.chunk.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  it('should return empty when no results', async () => {
    const rrf = new RRFSearch();
    const results = rrf.fuse([[]]);
    expect(results).toHaveLength(0);
  });

  it('should handle single result set', async () => {
    const set: SearchResult[] = [makeResult('x', 0.9)];
    const rrf = new RRFSearch();
    const results = rrf.fuse([set], 5);

    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.id).toBe('x');
    // RRF score = 1/(60+1) ≈ 0.01639
    expect(results[0]!.score).toBeCloseTo(1 / 61, 4);
  });

  it('should deduplicate same chunk across result sets', async () => {
    const set1: SearchResult[] = [makeResult('shared', 0.9)];
    const set2: SearchResult[] = [makeResult('shared', 0.8)];

    const rrf = new RRFSearch();
    const results = rrf.fuse([set1, set2], 5);

    const sharedResults = results.filter((r) => r.chunk.id === 'shared');
    expect(sharedResults).toHaveLength(1);
    // 两次 rank 1: 1/(60+1) + 1/(60+1)
    expect(sharedResults[0]!.score).toBeCloseTo(2 / 61, 4);
  });

  it('should support custom k parameter', async () => {
    const set: SearchResult[] = [makeResult('x', 0.9)];
    const rrf = new RRFSearch(10); // k=10
    const results = rrf.fuse([set], 5);

    // score = 1/(10+1) ≈ 0.0909
    expect(results[0]!.score).toBeCloseTo(1 / 11, 4);
  });
});
