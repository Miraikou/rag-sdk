import { describe, it, expect, vi } from 'vitest';
import { createSimpleRAG } from '../../src/pipeline/simple-rag';
import type { LLMProvider, EmbeddingProvider, VectorStore } from '@ragsdk/core';

/** 构建 mock 组件 */
function createMockComponents() {
  const llm: LLMProvider = {
    chat: vi.fn(async () => '测试回答'),
    chatStream: vi.fn(async function* () {}),
    chatJson: vi.fn(async () => ({})),
  };
  const embedding: EmbeddingProvider = {
    embed: vi.fn(async () => [0.1, 0.2, 0.3]),
    embedBatch: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
    dimension: 3,
  };
  const store: VectorStore = {
    upsert: vi.fn(async () => {}),
    upsertByDocument: vi.fn(async () => {}),
    search: vi.fn(async () => [
      {
        chunk: { id: 'c1', documentId: 'd1', content: '测试内容', metadata: {} },
        score: 0.9,
        source: 'vector' as const,
      },
    ]),
    delete: vi.fn(async () => {}),
    deleteByDocument: vi.fn(async () => {}),
  };
  return { llm, embedding, store };
}

describe('createSimpleRAG', () => {
  it('创建基础 Pipeline', async () => {
    const { llm, embedding, store } = createMockComponents();

    const pipeline = await createSimpleRAG({ llm, embedding, store });

    expect(pipeline).toBeDefined();
  });

  it('支持自定义 chunkSize 和 overlap', async () => {
    const { llm, embedding, store } = createMockComponents();

    const pipeline = await createSimpleRAG({
      llm,
      embedding,
      store,
      chunkSize: 1000,
      overlap: 100,
    });

    expect(pipeline).toBeDefined();
  });

  it('topK 参数传递到检索器', async () => {
    const { llm, embedding, store } = createMockComponents();

    const pipeline = await createSimpleRAG({
      llm,
      embedding,
      store,
      topK: 3,
    });

    await pipeline.query('测试问题');

    // store.search 应该被调用，且 topK 为 3
    expect(store.search).toHaveBeenCalled();
    const searchCall = (store.search as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(searchCall[1].topK).toBe(3);
  });
});
