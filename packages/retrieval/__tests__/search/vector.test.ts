import { describe, it, expect, vi } from 'vitest';
import { VectorSearch } from '../../src/search/vector';
import type { EmbeddingProvider, VectorStore, SearchResult } from '@ragsdk/core';

function createMockEmbedding(): EmbeddingProvider {
  return {
    embed: vi.fn().mockResolvedValue([1, 0, 0]),
    embedBatch: vi.fn().mockResolvedValue([[1, 0, 0]]),
    dimension: 3,
  };
}

function createMockStore(results: SearchResult[]): VectorStore {
  return {
    upsert: vi.fn(),
    upsertByDocument: vi.fn(),
    search: vi.fn().mockResolvedValue(results),
    delete: vi.fn(),
    deleteByDocument: vi.fn(),
  };
}

describe('VectorSearch', () => {
  it('should embed query and search store', async () => {
    const mockResult: SearchResult = {
      chunk: { id: 'c1', documentId: 'd1', content: 'test', metadata: {} },
      score: 0.95,
      source: 'vector',
    };

    const embedding = createMockEmbedding();
    const store = createMockStore([mockResult]);
    const search = new VectorSearch(embedding, store);

    const results = await search.retrieve('test query', { topK: 3 });

    expect(embedding.embed).toHaveBeenCalledWith('test query');
    expect(store.search).toHaveBeenCalledWith([1, 0, 0], { topK: 3, filter: undefined, threshold: undefined });
    expect(results).toHaveLength(1);
    expect(results[0]!.score).toBe(0.95);
  });

  it('should use default topK of 5', async () => {
    const embedding = createMockEmbedding();
    const store = createMockStore([]);
    const search = new VectorSearch(embedding, store);

    await search.retrieve('query');

    expect(store.search).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ topK: 5 }),
    );
  });

  it('should pass filter to store', async () => {
    const embedding = createMockEmbedding();
    const store = createMockStore([]);
    const search = new VectorSearch(embedding, store);

    await search.retrieve('query', { filter: { category: 'tech' } });

    expect(store.search).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ filter: { category: 'tech' } }),
    );
  });

  it('should pass threshold to store', async () => {
    const embedding = createMockEmbedding();
    const store = createMockStore([]);
    const search = new VectorSearch(embedding, store);

    await search.retrieve('query', { threshold: 0.7 });

    expect(store.search).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ threshold: 0.7 }),
    );
  });
});
