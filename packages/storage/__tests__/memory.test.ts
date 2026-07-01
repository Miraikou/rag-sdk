import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../src/memory';
import type { Chunk } from '@ragsdk/core';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  const makeChunk = (id: string, embedding: number[]): Chunk => ({
    id,
    documentId: 'doc-1',
    content: `content of ${id}`,
    metadata: {},
    embedding,
  });

  it('should upsert and search chunks', async () => {
    const chunks = [
      makeChunk('c1', [1, 0, 0]),
      makeChunk('c2', [0, 1, 0]),
      makeChunk('c3', [0, 0, 1]),
    ];
    await store.upsert(chunks);

    const results = await store.search([1, 0, 0], { topK: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.id).toBe('c1');
    expect(results[0]!.score).toBeCloseTo(1, 5);
  });

  it('should delete chunks', async () => {
    await store.upsert([makeChunk('c1', [1, 0])]);
    await store.delete(['c1']);
    const results = await store.search([1, 0]);
    expect(results).toHaveLength(0);
  });

  it('should delete by document', async () => {
    await store.upsert([
      makeChunk('c1', [1, 0]),
      makeChunk('c2', [0, 1]),
    ]);
    await store.deleteByDocument('doc-1');
    const results = await store.search([1, 0]);
    expect(results).toHaveLength(0);
  });

  it('should filter by threshold', async () => {
    await store.upsert([
      makeChunk('c1', [1, 0]),
      makeChunk('c2', [0.5, 0.5]),
    ]);
    const results = await store.search([1, 0], { threshold: 0.9 });
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.id).toBe('c1');
  });

  it('should filter by metadata', async () => {
    const chunk = makeChunk('c1', [1, 0]);
    chunk.metadata = { category: 'A' };
    await store.upsert([chunk, makeChunk('c2', [1, 0])]);

    const results = await store.search([1, 0], { filter: { category: 'A' } });
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.id).toBe('c1');
  });
});
