import { describe, it, expect, vi } from 'vitest';
import { RAGPipeline } from '../src/pipeline';
import type {
  Chunk,
  Chunker,
  Document,
  EmbeddingProvider,
  Generator,
  LLMProvider,
  VectorStore,
  SearchResult,
} from '../src/types';
import { CollectingMonitor } from '../src/monitor';
import { DefaultTokenBudgetManager, CharBasedTokenCounter } from '../src/token-budget';

/** 构建 mock LLMProvider */
function createMockLLM(): LLMProvider {
  return {
    chat: vi.fn(async () => '这是测试回答'),
    chatStream: vi.fn(async function* () {
      yield '这是';
      yield '流式';
      yield '回答';
    }),
    chatJson: vi.fn(async () => ({})) as unknown as LLMProvider['chatJson'],
  };
}

/** 构建 mock EmbeddingProvider */
function createMockEmbedding(): EmbeddingProvider {
  return {
    embed: vi.fn(async () => [0.1, 0.2, 0.3]),
    embedBatch: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
    dimension: 3,
  };
}

/** 构建 mock VectorStore */
function createMockStore(results?: SearchResult[]): VectorStore {
  return {
    upsert: vi.fn(async () => {}),
    upsertByDocument: vi.fn(async () => {}),
    search: vi.fn(
      async () =>
        results ?? [
          {
            chunk: { id: 'c1', documentId: 'd1', content: '测试内容', metadata: {} },
            score: 0.9,
            source: 'vector' as const,
          },
        ],
    ),
    delete: vi.fn(async () => {}),
    deleteByDocument: vi.fn(async () => {}),
  };
}

/** 构建 mock Chunker */
function createMockChunker(): Chunker {
  return {
    chunk: vi.fn((doc: Document) => [
      {
        id: 'c1',
        documentId: doc.id,
        content: doc.content,
        metadata: doc.metadata,
      },
    ]),
  };
}

describe('RAGPipeline queryStream', () => {
  it('支持 generateStream 时使用真流式', async () => {
    const llm = createMockLLM();
    const generator: Generator = {
      generate: vi.fn(async () => ({ answer: '这是流式回答', sources: [], metadata: {} })),
      generateStream: vi.fn(async function* () {
        yield '这是';
        yield '流式';
        yield '回答';
      }),
    };

    const pipeline = new RAGPipeline({
      llm,
      embedding: createMockEmbedding(),
      store: createMockStore(),
      chunker: createMockChunker(),
      generator,
    });

    const chunks: string[] = [];
    for await (const chunk of pipeline.queryStream('测试问题')) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['这是', '流式', '回答']);
    expect(generator.generateStream).toHaveBeenCalled();
  });

  it('不支持 generateStream 时降级为逐字符', async () => {
    const pipeline = new RAGPipeline({
      llm: createMockLLM(),
      embedding: createMockEmbedding(),
      store: createMockStore(),
      chunker: createMockChunker(),
    });

    const chunks: string[] = [];
    for await (const chunk of pipeline.queryStream('测试问题')) {
      chunks.push(chunk);
    }

    // 降级：完整回答被逐字符 yield
    const fullText = chunks.join('');
    expect(fullText).toBe('这是测试回答');
  });
});

describe('RAGPipeline with Monitor', () => {
  it('monitor 收到各阶段回调', async () => {
    const monitor = new CollectingMonitor();

    const pipeline = new RAGPipeline({
      llm: createMockLLM(),
      embedding: createMockEmbedding(),
      store: createMockStore(),
      chunker: createMockChunker(),
      monitor,
    });

    await pipeline.query('测试问题');

    const report = monitor.getLastReport()!;
    expect(report.queryDurationMs).toBeGreaterThanOrEqual(0);
    expect(report.stages.length).toBeGreaterThan(0);

    const stageNames = report.stages.map((s) => s.stage);
    expect(stageNames).toContain('transform');
    expect(stageNames).toContain('retrieve');
    expect(stageNames).toContain('generate');
  });
});

describe('RAGPipeline with TokenBudget', () => {
  it('token budget 截断上下文', async () => {
    const budget = new DefaultTokenBudgetManager(
      { maxTokens: 3, generationReserved: 0 },
      new CharBasedTokenCounter(),
    );

    const generateFn = vi.fn(async (query: string, chunks: Chunk[]) => ({
      answer: `回答基于 ${chunks.length} 个 chunk`,
      sources: [],
      metadata: {},
    }));

    const pipeline = new RAGPipeline({
      llm: createMockLLM(),
      embedding: createMockEmbedding(),
      store: createMockStore([
        {
          chunk: { id: 'c1', documentId: 'd1', content: '你好世界', metadata: {} },
          score: 0.9,
          source: 'vector',
        },
        {
          chunk: { id: 'c2', documentId: 'd1', content: '你好世界人', metadata: {} },
          score: 0.8,
          source: 'vector',
        },
      ]),
      chunker: createMockChunker(),
      tokenBudget: budget,
      generator: { generate: generateFn },
    });

    await pipeline.query('测试');

    // 预算 3 tokens，'你好世界' = 4 tokens > 3 → 0 chunks
    expect(generateFn).toHaveBeenCalledWith('测试', []);
  });
});
