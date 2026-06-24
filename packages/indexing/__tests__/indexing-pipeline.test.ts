import { describe, it, expect, vi } from 'vitest';
import type { Document, EmbeddingProvider } from '@rag-sdk/core';

// 创建 mock 依赖
function createMockEmbedding(): EmbeddingProvider {
  return {
    embed: vi.fn(async (text: string) => {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) % 1000;
      }
      return [hash / 1000, (hash * 7) % 1000 / 1000, (hash * 13) % 1000 / 1000];
    }),
    embedBatch: vi.fn(async (texts: string[]) => {
      return texts.map((text) => {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = (hash * 31 + text.charCodeAt(i)) % 1000;
        }
        return [hash / 1000, (hash * 7) % 1000 / 1000, (hash * 13) % 1000 / 1000];
      });
    }),
    dimension: 3,
  };
}

describe('IndexingPipeline', () => {
  it('should export IndexingPipeline', async () => {
    const { IndexingPipeline } = await import('../src/indexing-pipeline.js');
    expect(IndexingPipeline).toBeDefined();
  });

  it('should index documents with all stages enabled', async () => {
    const { IndexingPipeline } = await import('../src/indexing-pipeline.js');
    const { MemoryStore } = await import('@rag-sdk/storage');
    const { FixedSizeChunker } = await import('@rag-sdk/document');

    const pipeline = new IndexingPipeline({
      store: new MemoryStore(),
      embedding: createMockEmbedding(),
      chunker: new FixedSizeChunker(),
      chunkOptions: { chunkSize: 100, overlap: 20 },
    } as never); // chunkOptions 不在 IndexingConfig 中但实现接受

    const docs: Document[] = [
      { id: 'doc-1', content: 'RAG 是一种 AI 技术框架。', metadata: {} },
      { id: 'doc-2', content: '向量数据库用于存储 embedding。', metadata: {} },
    ];

    const report = await pipeline.index(docs);
    expect(report).toBeDefined();
    expect(report.documentsLoaded).toBe(2);
    expect(report.chunksCreated).toBeGreaterThan(0);
    expect(report.duration).toBeGreaterThanOrEqual(0);
  });

  it('should index documents with only required stages', async () => {
    const { IndexingPipeline } = await import('../src/indexing-pipeline.js');
    const { MemoryStore } = await import('@rag-sdk/storage');
    const { FixedSizeChunker } = await import('@rag-sdk/document');

    const pipeline = new IndexingPipeline({
      store: new MemoryStore(),
      embedding: createMockEmbedding(),
      chunker: new FixedSizeChunker(),
    });

    const docs: Document[] = [
      { id: 'doc-1', content: '最小配置索引测试。', metadata: {} },
    ];

    const report = await pipeline.index(docs);
    expect(report.documentsLoaded).toBe(1);
    expect(report.chunksCreated).toBeGreaterThan(0);
  });

  it('should reindex a single document', async () => {
    const { IndexingPipeline } = await import('../src/indexing-pipeline.js');
    const { MemoryStore } = await import('@rag-sdk/storage');
    const { FixedSizeChunker } = await import('@rag-sdk/document');

    const pipeline = new IndexingPipeline({
      store: new MemoryStore(),
      embedding: createMockEmbedding(),
      chunker: new FixedSizeChunker(),
    });

    // 首次索引
    const doc: Document = { id: 'doc-1', content: '初始索引内容。', metadata: {} };
    const report1 = await pipeline.index([doc]);
    expect(report1.chunksCreated).toBeGreaterThan(0);

    // 更新索引
    const updatedDoc: Document = { id: 'doc-1', content: '更新后的内容，增加了更多文本信息。', metadata: {} };
    const report2 = await pipeline.index([updatedDoc]);
    expect(report2.documentsLoaded).toBe(1);
    expect(report2.chunksCreated).toBeGreaterThan(0);
  });

  it('should throw if loader is missing for indexFromSource', async () => {
    const { IndexingPipeline } = await import('../src/indexing-pipeline.js');
    const { MemoryStore } = await import('@rag-sdk/storage');
    const { FixedSizeChunker } = await import('@rag-sdk/document');

    const pipeline = new IndexingPipeline({
      store: new MemoryStore(),
      embedding: createMockEmbedding(),
      chunker: new FixedSizeChunker(),
    });

    await expect(
      pipeline.indexFromSource('file.txt'),
    ).rejects.toThrow('loader is required');
  });
});
