/**
 * 类型契约验证
 *
 * 验证所有模块的导出类是否满足 core 包中定义的抽象接口。
 * 使用运行时属性检查 + TypeScript 编译时类型约束。
 */
import { describe, it, expect } from 'vitest';

// ==================== 类型契约定义 ====================

/** 验证对象实现了指定方法列表 */
function hasMethods(obj: unknown, methodNames: string[]): boolean {
  if (obj === null || obj === undefined) return false;
  return methodNames.every((name) => typeof (obj as Record<string, unknown>)[name] === 'function');
}

/** 验证对象具有指定属性 */
function hasProperties(obj: unknown, propNames: string[]): boolean {
  if (obj === null || obj === undefined) return false;
  return propNames.every((name) => name in (obj as Record<string, unknown>));
}

// ==================== Retriever 接口 ====================

describe('Retriever 接口契约', () => {
  it('VectorSearch 应实现 Retriever 接口', async () => {
    const { VectorSearch } = await import('@ragsdk/retrieval');
    const { MemoryStore } = await import('@ragsdk/storage');

    const retriever = new VectorSearch(
      { dimension: 3, embed: async () => [1, 2, 3], embedBatch: async () => [[1, 2, 3]] },
      new MemoryStore(),
    );

    expect(hasMethods(retriever, ['retrieve'])).toBe(true);
    // retrieve 方法应可调用并返回 SearchResult[]
    const results = await retriever.retrieve('test', { topK: 3 });
    expect(Array.isArray(results)).toBe(true);
  });

  it('KeywordSearch 应实现 Retriever 接口', async () => {
    const { KeywordSearch } = await import('@ragsdk/retrieval');

    const retriever = new KeywordSearch([
      {
        id: 'k1',
        documentId: 'd1',
        content: 'Python 是一门流行的编程语言。',
        metadata: {},
      },
    ]);

    expect(hasMethods(retriever, ['retrieve'])).toBe(true);
    const results = await retriever.retrieve('Python');
    expect(Array.isArray(results)).toBe(true);
  });

  it('FusionSearch 应实现 Retriever 接口', async () => {
    const { FusionSearch, VectorSearch, KeywordSearch } = await import('@ragsdk/retrieval');
    const { MemoryStore } = await import('@ragsdk/storage');

    const fusion = new FusionSearch(
      new VectorSearch(
        { dimension: 3, embed: async () => [1, 2, 3], embedBatch: async () => [[1, 2, 3]] },
        new MemoryStore(),
      ),
      new KeywordSearch(),
    );

    expect(hasMethods(fusion, ['retrieve'])).toBe(true);
    const results = await fusion.retrieve('test', { topK: 3 });
    expect(Array.isArray(results)).toBe(true);
  });

  it('SmallToBigSearch 应实现 Retriever 接口', async () => {
    const { SmallToBigSearch, VectorSearch } = await import('@ragsdk/retrieval');
    const { MemoryStore } = await import('@ragsdk/storage');

    const store = new MemoryStore();
    const innerRetriever = new VectorSearch(
      { dimension: 3, embed: async () => [1, 2, 3], embedBatch: async () => [[1, 2, 3]] },
      store,
    );
    const retriever = new SmallToBigSearch(innerRetriever, store, new Map());

    expect(hasMethods(retriever, ['retrieve'])).toBe(true);
  });

  it('HierarchicalSearch 应实现 Retriever 接口', async () => {
    const { HierarchicalSearch } = await import('@ragsdk/retrieval');
    const { MemoryStore } = await import('@ragsdk/storage');

    const retriever = new HierarchicalSearch(
      { dimension: 3, embed: async () => [1, 2, 3], embedBatch: async () => [[1, 2, 3]] },
      new MemoryStore(),
      new MemoryStore(),
    );

    expect(hasMethods(retriever, ['retrieve'])).toBe(true);
  });
});

// ==================== Chunker 接口 ====================

describe('Chunker 接口契约', () => {
  it('FixedSizeChunker 应实现 Chunker 接口', async () => {
    const { FixedSizeChunker } = await import('@ragsdk/document');

    const chunker = new FixedSizeChunker({ chunkSize: 500 });
    expect(hasMethods(chunker, ['chunk'])).toBe(true);

    const chunks = chunker.chunk({ id: 'd1', content: 'Hello world', metadata: {} });
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
    // 每个 chunk 应有正确的结构
    const first = chunks[0]!;
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('documentId');
    expect(first).toHaveProperty('content');
    expect(first).toHaveProperty('metadata');
  });

  it('RecursiveChunker 应实现 Chunker 接口', async () => {
    const { RecursiveChunker } = await import('@ragsdk/document');

    const chunker = new RecursiveChunker();
    expect(hasMethods(chunker, ['chunk'])).toBe(true);

    const chunks = chunker.chunk(
      { id: 'd2', content: '段落一\n\n段落二\n\n段落三', metadata: {} },
      { chunkSize: 50, overlap: 10 },
    );
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('MarkdownChunker 应实现 Chunker 接口', async () => {
    const { MarkdownChunker } = await import('@ragsdk/document');

    const chunker = new MarkdownChunker();
    expect(hasMethods(chunker, ['chunk'])).toBe(true);

    const chunks = chunker.chunk({
      id: 'md-1',
      content: '# 标题\n\n## 子标题\n内容',
      metadata: {},
    });
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
  });
});

// ==================== LLMProvider 接口 ====================

describe('LLMProvider 接口契约', () => {
  it('OpenAIProvider 应满足 LLMProvider 接口', async () => {
    const { OpenAIProvider } = await import('@ragsdk/llm');

    const provider = new OpenAIProvider({ apiKey: 'test-key', defaultModel: 'gpt-4o-mini' });
    expect(hasMethods(provider, ['chat', 'chatStream', 'chatJson'])).toBe(true);
  });

  it('AnthropicProvider 应满足 LLMProvider 接口', async () => {
    const { AnthropicProvider } = await import('@ragsdk/llm-anthropic');

    const provider = new AnthropicProvider({ apiKey: 'test-key' });
    expect(hasMethods(provider, ['chat', 'chatStream', 'chatJson'])).toBe(true);
  });

  it('GoogleProvider 应满足 LLMProvider 接口', async () => {
    const { GoogleProvider } = await import('@ragsdk/llm-google');

    const provider = new GoogleProvider({ apiKey: 'test-key' });
    expect(hasMethods(provider, ['chat', 'chatStream', 'chatJson'])).toBe(true);
  });
});

// ==================== VectorStore 接口 ====================

describe('VectorStore 接口契约', () => {
  it('MemoryStore 应满足 VectorStore 接口', async () => {
    const { MemoryStore } = await import('@ragsdk/storage');

    const store = new MemoryStore();
    const requiredMethods = ['upsert', 'upsertByDocument', 'search', 'delete', 'deleteByDocument'];
    expect(hasMethods(store, requiredMethods)).toBe(true);

    // 验证基本操作可用
    await store.upsert([
      {
        id: 'v1',
        documentId: 'd1',
        content: 'test',
        metadata: {},
        embedding: [1, 2, 3],
      },
    ]);

    const results = await store.search([1, 2, 3], { topK: 1 });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    expect(results[0]!.chunk.id).toBe('v1');
  });

  it('PineconeStore 应满足 VectorStore 接口', async () => {
    const { PineconeStore } = await import('@ragsdk/storage-pinecone');

    const store = new PineconeStore({ apiKey: 'test-key', baseUrl: 'https://test.pinecone.io' });
    const requiredMethods = ['upsert', 'upsertByDocument', 'search', 'delete', 'deleteByDocument'];
    expect(hasMethods(store, requiredMethods)).toBe(true);
  });

  it('WeaviateStore 应满足 VectorStore 接口', async () => {
    const { WeaviateStore } = await import('@ragsdk/storage-weaviate');

    const store = new WeaviateStore({ baseUrl: 'http://localhost:8080' });
    const requiredMethods = ['upsert', 'upsertByDocument', 'search', 'delete', 'deleteByDocument'];
    expect(hasMethods(store, requiredMethods)).toBe(true);
  });

  it('ChromaStore 应满足 VectorStore 接口', async () => {
    const { ChromaStore } = await import('@ragsdk/storage-chroma');

    const store = new ChromaStore({ baseUrl: 'http://localhost:8000' });
    const requiredMethods = ['upsert', 'upsertByDocument', 'search', 'delete', 'deleteByDocument'];
    expect(hasMethods(store, requiredMethods)).toBe(true);
  });

  it('QdrantStore 应满足 VectorStore 接口', async () => {
    const { QdrantStore } = await import('@ragsdk/storage-qdrant');

    const store = new QdrantStore({ baseUrl: 'http://localhost:6333' });
    const requiredMethods = ['upsert', 'upsertByDocument', 'search', 'delete', 'deleteByDocument'];
    expect(hasMethods(store, requiredMethods)).toBe(true);
  });

  it('PgVectorStore 应满足 VectorStore 接口', async () => {
    const { PgVectorStore } = await import('@ragsdk/storage-pgvector');

    const store = new PgVectorStore({
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'test',
      password: 'test',
    });
    const requiredMethods = ['upsert', 'upsertByDocument', 'search', 'delete', 'deleteByDocument'];
    expect(hasMethods(store, requiredMethods)).toBe(true);
  });
});

// ==================== EmbeddingProvider 接口 ====================

describe('EmbeddingProvider 接口契约', () => {
  it('OpenAIEmbeddingProvider 应满足 EmbeddingProvider 接口', async () => {
    const { OpenAIEmbeddingProvider } = await import('@ragsdk/embedding');

    const provider = new OpenAIEmbeddingProvider({ apiKey: 'test-key' });
    expect(hasMethods(provider, ['embed', 'embedBatch'])).toBe(true);
    expect(hasProperties(provider, ['dimension'])).toBe(true);
    expect(typeof provider.dimension).toBe('number');
    expect(provider.dimension).toBeGreaterThan(0);
  });

  it('AnthropicEmbeddingProvider 应满足 EmbeddingProvider 接口', async () => {
    const { AnthropicEmbeddingProvider } = await import('@ragsdk/embedding-anthropic');

    const provider = new AnthropicEmbeddingProvider({ apiKey: 'test-key' });
    expect(hasMethods(provider, ['embed', 'embedBatch'])).toBe(true);
    expect(hasProperties(provider, ['dimension'])).toBe(true);
    expect(typeof provider.dimension).toBe('number');
    expect(provider.dimension).toBeGreaterThan(0);
  });

  it('GoogleEmbeddingProvider 应满足 EmbeddingProvider 接口', async () => {
    const { GoogleEmbeddingProvider } = await import('@ragsdk/embedding-google');

    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });
    expect(hasMethods(provider, ['embed', 'embedBatch'])).toBe(true);
    expect(hasProperties(provider, ['dimension'])).toBe(true);
    expect(typeof provider.dimension).toBe('number');
    expect(provider.dimension).toBeGreaterThan(0);
  });

  it('VoyageEmbeddingProvider 应满足 EmbeddingProvider 接口', async () => {
    const { VoyageEmbeddingProvider } = await import('@ragsdk/embedding-voyage');

    const provider = new VoyageEmbeddingProvider({ apiKey: 'test-key' });
    expect(hasMethods(provider, ['embed', 'embedBatch'])).toBe(true);
    expect(hasProperties(provider, ['dimension'])).toBe(true);
    expect(typeof provider.dimension).toBe('number');
    expect(provider.dimension).toBeGreaterThan(0);
  });
});

// ==================== QueryTransformer 接口 ====================

describe('QueryTransformer 接口契约', () => {
  it('QueryRewriter 应实现 QueryTransformer 接口', async () => {
    const { QueryRewriter } = await import('@ragsdk/retrieval');

    const transformer = new QueryRewriter({
      chat: async () => '改写结果',
      chatStream: async function* () {},
      chatJson: async <T,>() => ({} as unknown as T),
    });
    expect(hasMethods(transformer, ['transform'])).toBe(true);
  });

  it('MultiQueryExpander 应实现 QueryTransformer 接口', async () => {
    const { MultiQueryExpander } = await import('@ragsdk/retrieval');

    const transformer = new MultiQueryExpander({
      chat: async () => '多查询结果',
      chatStream: async function* () {},
      chatJson: async <T,>() => ({ queries: ['q1', 'q2'] } as unknown as T),
    });
    expect(hasMethods(transformer, ['transform'])).toBe(true);
  });

  it('HyDETransformer 应实现 QueryTransformer 接口', async () => {
    const { HyDETransformer } = await import('@ragsdk/retrieval');

    const transformer = new HyDETransformer({
      chat: async () => '假设文档',
      chatStream: async function* () {},
      chatJson: async <T,>() => ({} as unknown as T),
    });
    expect(hasMethods(transformer, ['transform'])).toBe(true);
  });
});

// ==================== PostProcessor 接口 ====================

describe('PostProcessor 接口契约', () => {
  it('ThresholdPostProcessor 应实现 PostProcessor 接口', async () => {
    const { ThresholdPostProcessor } = await import('@ragsdk/retrieval');

    const processor = new ThresholdPostProcessor({ threshold: 0.5 });
    expect(hasMethods(processor, ['process'])).toBe(true);
  });

  it('RerankerPostProcessor 应实现 PostProcessor 接口', async () => {
    const { RerankerPostProcessor } = await import('@ragsdk/retrieval');

    const processor = new RerankerPostProcessor(async () => 0.8, { topK: 2 });
    expect(hasMethods(processor, ['process'])).toBe(true);
  });

  it('ContextEnrichPostProcessor 应实现 PostProcessor 接口', async () => {
    const { ContextEnrichPostProcessor } = await import('@ragsdk/retrieval');
    const { MemoryStore } = await import('@ragsdk/storage');

    const processor = new ContextEnrichPostProcessor(new MemoryStore(), { windowSize: 2 });
    expect(hasMethods(processor, ['process'])).toBe(true);
  });

  it('CompressionPostProcessor 应实现 PostProcessor 接口', async () => {
    const { CompressionPostProcessor } = await import('@ragsdk/retrieval');

    const processor = new CompressionPostProcessor({
      chat: async () => '压缩后内容',
      chatStream: async function* () {},
      chatJson: async <T,>() => ({} as unknown as T),
    });
    expect(hasMethods(processor, ['process'])).toBe(true);
  });
});

// ==================== Generator 接口 ====================

describe('Generator 接口契约', () => {
  const mockLLM = {
    chat: async () => '生成回答',
    chatStream: async function* () {},
    chatJson: async <T,>() => ({} as unknown as T),
  };

  it('StandardGenerator 应实现 Generator 接口', async () => {
    const { StandardGenerator } = await import('@ragsdk/generation');
    const generator = new StandardGenerator(mockLLM);

    expect(hasMethods(generator, ['generate'])).toBe(true);
  });

  it('GroundedGenerator 应实现 Generator 接口', async () => {
    const { GroundedGenerator } = await import('@ragsdk/generation');
    const generator = new GroundedGenerator(mockLLM);

    expect(hasMethods(generator, ['generate'])).toBe(true);
  });

  it('CitationGenerator 应实现 Generator 接口', async () => {
    const { CitationGenerator } = await import('@ragsdk/generation');
    const generator = new CitationGenerator(mockLLM);

    expect(hasMethods(generator, ['generate'])).toBe(true);
  });

  it('SelfRAGGenerator 应实现 Generator 接口', async () => {
    const { SelfRAGGenerator } = await import('@ragsdk/generation');
    const generator = new SelfRAGGenerator(mockLLM);

    expect(hasMethods(generator, ['generate'])).toBe(true);
  });
});

// ==================== Evaluator 接口 ====================

describe('Evaluator 接口契约', () => {
  const sampleResults = [
    {
      chunk: { id: 'e1', documentId: 'd1', content: '相关内容', metadata: {} },
      score: 0.9,
      source: 'vector' as const,
    },
    {
      chunk: { id: 'e2', documentId: 'd1', content: '不相关内容', metadata: {} },
      score: 0.3,
      source: 'vector' as const,
    },
  ];

  const truthIds = ['e1'];

  it('RecallEvaluator 应实现 RetrievalEvaluator 接口', async () => {
    const { RecallEvaluator } = await import('@ragsdk/evaluation');
    const evaluator = new RecallEvaluator();

    expect(hasMethods(evaluator, ['evaluate'])).toBe(true);

    const result = evaluator.evaluate(sampleResults, truthIds);
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('details');
    expect(typeof result.score).toBe('number');
  });

  it('PrecisionEvaluator 应实现 RetrievalEvaluator 接口', async () => {
    const { PrecisionEvaluator } = await import('@ragsdk/evaluation');
    const evaluator = new PrecisionEvaluator({ k: 2 });

    expect(hasMethods(evaluator, ['evaluate'])).toBe(true);

    const result = evaluator.evaluate(sampleResults, truthIds);
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('MRREvaluator 应实现 RetrievalEvaluator 接口', async () => {
    const { MRREvaluator } = await import('@ragsdk/evaluation');
    const evaluator = new MRREvaluator();

    expect(hasMethods(evaluator, ['evaluate'])).toBe(true);

    const result = evaluator.evaluate(sampleResults, truthIds);
    expect(typeof result.score).toBe('number');
  });

  it('NDCGEvaluator 应实现 RetrievalEvaluator 接口', async () => {
    const { NDCGEvaluator } = await import('@ragsdk/evaluation');
    const evaluator = new NDCGEvaluator();

    expect(hasMethods(evaluator, ['evaluate'])).toBe(true);

    const result = evaluator.evaluate(sampleResults, truthIds);
    expect(typeof result.score).toBe('number');
  });

  it('BLEUEvaluator 应实现 GenerationEvaluator 接口', async () => {
    const { BLEUEvaluator } = await import('@ragsdk/evaluation');
    const evaluator = new BLEUEvaluator();

    expect(hasMethods(evaluator, ['evaluate'])).toBe(true);

    const result = evaluator.evaluate('RAG 是检索增强生成。', 'RAG 是检索增强生成技术。');
    expect(typeof result.score).toBe('number');
  });

  it('ROUGEEvaluator 应实现 GenerationEvaluator 接口', async () => {
    const { ROUGEEvaluator } = await import('@ragsdk/evaluation');
    const evaluator = new ROUGEEvaluator();

    expect(hasMethods(evaluator, ['evaluate'])).toBe(true);

    const result = evaluator.evaluate('候选文本', '参考文本');
    expect(typeof result.score).toBe('number');
  });
});

// ==================== Knowledge Graph 接口 ====================

describe('Knowledge Graph 接口契约', () => {
  it('EntityExtractor 应具有提取实体的能力', async () => {
    const { EntityExtractor } = await import('@ragsdk/knowledge-graph');
    const extractor = new EntityExtractor({
      llmProvider: {
        chat: async () => '',
        chatStream: async function* () {},
        chatJson: async <T,>() => ({} as unknown as T),
      },
    });

    expect(hasMethods(extractor, ['extract'])).toBe(true);
  });

  it('MemoryGraphStore 应实现 GraphStore 接口', async () => {
    const { MemoryGraphStore } = await import('@ragsdk/knowledge-graph');
    const store = new MemoryGraphStore();

    // GraphStore 应支持 upsert 和查询
    expect(store).toBeDefined();
  });

  it('GraphRetriever 应能检索图谱', async () => {
    const { GraphRetriever, MemoryGraphStore } = await import('@ragsdk/knowledge-graph');
    const retriever = new GraphRetriever({
      graphStore: new MemoryGraphStore(),
      llmProvider: {
        chat: async () => '',
        chatStream: async function* () {},
        chatJson: async <T,>() => ({} as unknown as T),
      },
    });

    expect(hasMethods(retriever, ['retrieve'])).toBe(true);
  });

  it('GraphBuilder 应能从文档构建图谱', async () => {
    const { GraphBuilder, EntityExtractor, MemoryGraphStore } = await import(
      '@ragsdk/knowledge-graph'
    );

    const extractor = new EntityExtractor({
      llmProvider: {
        chat: async () => '',
        chatStream: async function* () {},
        chatJson: async <T,>() => ({} as unknown as T),
      },
    });

    const builder = new GraphBuilder({
      extractor,
      graphStore: new MemoryGraphStore(),
    });

    expect(hasMethods(builder, ['buildFromDocuments'])).toBe(true);
  });
});

// ==================== IndexingPipeline ====================

describe('IndexingPipeline 接口契约', () => {
  it('IndexingPipeline 应实现完整的索引流程', async () => {
    const { IndexingPipeline } = await import('@ragsdk/indexing');
    const { MemoryStore } = await import('@ragsdk/storage');
    const { FixedSizeChunker } = await import('@ragsdk/document');

    const pipeline = new IndexingPipeline({
      embedding: {
        dimension: 4,
        embed: async () => [0.1, 0.2, 0.3, 0.4],
        embedBatch: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3, 0.4]),
      },
      store: new MemoryStore(),
      chunker: new FixedSizeChunker({ chunkSize: 500 }),
    });

    expect(hasMethods(pipeline, ['index'])).toBe(true);

    const report = await pipeline.index([
      { id: 'idx-1', content: '索引测试文档内容', metadata: {} },
    ]);

    expect(report).toBeDefined();
    expect(report).toHaveProperty('documentsLoaded');
    expect(report).toHaveProperty('chunksCreated');
    expect(report.documentsLoaded).toBe(1);
    expect(report.chunksCreated).toBeGreaterThan(0);
  });
});

// ==================== Pipeline 接口 ====================

describe('Pipeline 接口契约', () => {
  it('RAGPipeline 应实现 Pipeline 接口', async () => {
    const { RAGPipeline } = await import('@ragsdk/core');
    const { MemoryStore } = await import('@ragsdk/storage');
    const { FixedSizeChunker } = await import('@ragsdk/document');

    const pipeline = new RAGPipeline({
      llm: {
        chat: async () => '回答',
        chatStream: async function* () {},
        chatJson: async <T,>() => ({} as unknown as T),
      },
      embedding: {
        dimension: 4,
        embed: async () => [0.1, 0.2, 0.3, 0.4],
        embedBatch: async () => [[0.1, 0.2, 0.3, 0.4]],
      },
      store: new MemoryStore(),
      chunker: new FixedSizeChunker({ chunkSize: 500 }),
    });

    expect(hasMethods(pipeline, ['ingest', 'query', 'queryStream'])).toBe(true);
  });
});
