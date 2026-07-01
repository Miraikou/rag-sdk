import { describe, it, expect, vi } from 'vitest';
import { PipelineBuilder } from '../../src/pipeline/custom';
import type { LLMProvider, EmbeddingProvider, VectorStore, Chunker } from '@ragsdk/core';

/** 构建 mock 组件 */
function createMockComponents() {
  const llm: LLMProvider = {
    chat: vi.fn(async () => ''),
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
    search: vi.fn(async () => []),
    delete: vi.fn(async () => {}),
    deleteByDocument: vi.fn(async () => {}),
  };
  const chunker: Chunker = {
    chunk: vi.fn(() => []),
  };
  return { llm, embedding, store, chunker };
}

describe('PipelineBuilder', () => {
  it('链式构建 Pipeline', () => {
    const { llm, embedding, store, chunker } = createMockComponents();

    const pipeline = new PipelineBuilder()
      .setLLM(llm)
      .setEmbedding(embedding)
      .setStore(store)
      .setChunker(chunker)
      .build();

    expect(pipeline).toBeDefined();
  });

  it('缺少 llm 时抛出错误', () => {
    const { embedding, store, chunker } = createMockComponents();

    expect(() => {
      new PipelineBuilder().setEmbedding(embedding).setStore(store).setChunker(chunker).build();
    }).toThrow('llm is required');
  });

  it('缺少 embedding 时抛出错误', () => {
    const { llm, store, chunker } = createMockComponents();

    expect(() => {
      new PipelineBuilder().setLLM(llm).setStore(store).setChunker(chunker).build();
    }).toThrow('embedding is required');
  });

  it('缺少 store 时抛出错误', () => {
    const { llm, embedding, chunker } = createMockComponents();

    expect(() => {
      new PipelineBuilder().setLLM(llm).setEmbedding(embedding).setChunker(chunker).build();
    }).toThrow('store is required');
  });

  it('缺少 chunker 时抛出错误', () => {
    const { llm, embedding, store } = createMockComponents();

    expect(() => {
      new PipelineBuilder().setLLM(llm).setEmbedding(embedding).setStore(store).build();
    }).toThrow('chunker is required');
  });

  it('支持可选组件', () => {
    const { llm, embedding, store, chunker } = createMockComponents();

    const monitor = {
      onStageStart: vi.fn(),
      onStageEnd: vi.fn(),
      onQueryComplete: vi.fn(),
    };

    const pipeline = new PipelineBuilder()
      .setLLM(llm)
      .setEmbedding(embedding)
      .setStore(store)
      .setChunker(chunker)
      .setMonitor(monitor)
      .build();

    expect(pipeline).toBeDefined();
  });

  it('支持 addQueryTransformer 和 addPostProcessor', () => {
    const { llm, embedding, store, chunker } = createMockComponents();

    const transformer = { transform: vi.fn(async (q: string) => q) };
    const processor = { process: vi.fn(async (results: unknown[]) => results) };

    const pipeline = new PipelineBuilder()
      .setLLM(llm)
      .setEmbedding(embedding)
      .setStore(store)
      .setChunker(chunker)
      .addQueryTransformer(transformer)
      .addPostProcessor(processor)
      .build();

    expect(pipeline).toBeDefined();
  });
});
