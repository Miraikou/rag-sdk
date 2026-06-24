import { describe, it, expect, vi } from 'vitest';
import { MemoryStore } from '@rag-sdk/storage';
import type { EmbeddingProvider } from '@rag-sdk/core';

describe('HierarchicalSearch', () => {
  it('should export HierarchicalSearch', async () => {
    const { HierarchicalSearch } = await import('../../src/search/hierarchical');
    expect(HierarchicalSearch).toBeDefined();
  });

  it('should create instance with embedding and two stores', async () => {
    const { HierarchicalSearch } = await import('../../src/search/hierarchical');

    const mockEmbedding: EmbeddingProvider = {
      embed: vi.fn().mockResolvedValue([1, 0, 0]),
      embedBatch: vi.fn().mockResolvedValue([[1, 0, 0]]),
      dimension: 3,
    };

    const summaryStore = new MemoryStore();
    const contentStore = new MemoryStore();

    const search = new HierarchicalSearch(mockEmbedding, summaryStore, contentStore);
    expect(search).toBeDefined();
    expect(typeof search.retrieve).toBe('function');
  });

  it('should search in two stages: summary then detailed', async () => {
    const { HierarchicalSearch } = await import('../../src/search/hierarchical');

    const mockEmbedding: EmbeddingProvider = {
      embed: vi.fn().mockResolvedValue([1, 0, 0]),
      embedBatch: vi.fn().mockResolvedValue([[1, 0, 0]]),
      dimension: 3,
    };

    const summaryStore = new MemoryStore();
    const contentStore = new MemoryStore();

    // 添加摘要层 chunks
    await summaryStore.upsert([
      {
        id: 'summary-1',
        documentId: 'doc-1',
        content: 'RAG 概述摘要',
        metadata: { level: 'summary' },
        embedding: [1, 0, 0],
      },
    ]);

    // 添加内容层 chunks
    await contentStore.upsert([
      {
        id: 'detail-1',
        documentId: 'doc-1',
        content: 'RAG 详细说明：检索部分',
        metadata: { level: 'detail' },
        embedding: [0.9, 0.1, 0],
      },
      {
        id: 'detail-2',
        documentId: 'doc-1',
        content: 'RAG 详细说明：生成部分',
        metadata: { level: 'detail' },
        embedding: [0.8, 0.2, 0],
      },
    ]);

    const search = new HierarchicalSearch(mockEmbedding, summaryStore, contentStore);
    const results = await search.retrieve('RAG 架构', { topK: 2 });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => {
      expect(r.chunk.id).toBeDefined();
    });
  });
});
