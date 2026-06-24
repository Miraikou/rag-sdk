import { describe, it, expect, vi } from 'vitest';
import { MemoryStore } from '@rag-sdk/storage';
import { VectorSearch } from '../../src/search/vector';
import type { EmbeddingProvider, Chunk } from '@rag-sdk/core';

describe('SmallToBigSearch', () => {
  it('should export SmallToBigSearch', async () => {
    const { SmallToBigSearch } = await import('../../src/search/small-to-big');
    expect(SmallToBigSearch).toBeDefined();
  });

  it('should create instance', async () => {
    const { SmallToBigSearch } = await import('../../src/search/small-to-big');
    const store = new MemoryStore();

    const mockEmbedding: EmbeddingProvider = {
      embed: vi.fn().mockResolvedValue([1, 0, 0]),
      embedBatch: vi.fn().mockResolvedValue([[1, 0, 0]]),
      dimension: 3,
    };

    // SmallToBigSearch 需要一个 innerRetriever
    const innerRetriever = new VectorSearch(mockEmbedding, store);
    const search = new SmallToBigSearch(innerRetriever, store);
    expect(search).toBeDefined();
    expect(typeof search.retrieve).toBe('function');
  });

  it('should search with small chunks and expand to parent', async () => {
    const { SmallToBigSearch } = await import('../../src/search/small-to-big');
    const store = new MemoryStore();

    const mockEmbedding: EmbeddingProvider = {
      embed: vi.fn().mockResolvedValue([1, 0, 0]),
      embedBatch: vi.fn().mockResolvedValue([[1, 0, 0]]),
      dimension: 3,
    };

    const innerRetriever = new VectorSearch(mockEmbedding, store);

    // 注册所有 chunks（小 chunks 和父 chunks）
    const chunks: Chunk[] = [
      {
        id: 'small-1',
        documentId: 'doc-1',
        content: 'RAG is a technique',
        metadata: {},
        embedding: [1, 0, 0],
        parentId: 'big-1',
      },
      {
        id: 'small-2',
        documentId: 'doc-1',
        content: 'Vector databases',
        metadata: {},
        embedding: [0, 1, 0],
        parentId: 'big-1',
      },
      {
        id: 'big-1',
        documentId: 'doc-1',
        content: 'RAG combines retrieval with generation. It uses vector databases.',
        metadata: {},
        embedding: [0.7, 0.7, 0],
        children: ['small-1', 'small-2'],
      },
    ];

    await store.upsert(chunks);

    const search = new SmallToBigSearch(innerRetriever, store, new Map());
    search.registerChunks(chunks);

    const results = await search.retrieve('RAG technique', { topK: 1 });
    expect(results.length).toBeGreaterThan(0);
  });
});
