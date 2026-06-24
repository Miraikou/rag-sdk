import { describe, it, expect, vi } from 'vitest';
import { createAdvancedRAG } from '../../src/pipeline/advanced-rag';
import type { LLMProvider, EmbeddingProvider, VectorStore } from '@rag-sdk/core';

/** 构建 mock 组件 */
function createMockComponents() {
  const llm: LLMProvider = {
    chat: vi.fn(async () => '改写的查询'),
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

describe('createAdvancedRAG', () => {
  it('创建 Advanced RAG Pipeline', async () => {
    const { llm, embedding, store } = createMockComponents();

    const pipeline = await createAdvancedRAG({ llm, embedding, store });

    expect(pipeline).toBeDefined();
  });

  it('支持自定义融合权重', async () => {
    const { llm, embedding, store } = createMockComponents();

    const pipeline = await createAdvancedRAG({
      llm,
      embedding,
      store,
      vectorWeight: 0.8,
      keywordWeight: 0.2,
    });

    expect(pipeline).toBeDefined();
  });

  it('支持自定义阈值和 topK', async () => {
    const { llm, embedding, store } = createMockComponents();

    const pipeline = await createAdvancedRAG({
      llm,
      embedding,
      store,
      threshold: 0.7,
      topK: 5,
    });

    expect(pipeline).toBeDefined();
  });

  it('提供 rerankerScorer 时启用重排序', async () => {
    const { llm, embedding, store } = createMockComponents();

    const rerankerScorer = vi.fn(async () => 0.95);
    const pipeline = await createAdvancedRAG({
      llm,
      embedding,
      store,
      rerankerScorer,
      rerankTopK: 3,
    });

    expect(pipeline).toBeDefined();
  });

  it('查询时执行完整的 Advanced RAG 流水线', async () => {
    const { llm, embedding, store } = createMockComponents();

    const pipeline = await createAdvancedRAG({ llm, embedding, store });

    const result = await pipeline.query('测试问题');

    // LLM 被调用（查询改写 + 生成）
    expect(llm.chat).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.answer).toBeDefined();
  });
});
