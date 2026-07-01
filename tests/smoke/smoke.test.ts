/**
 * 冒烟测试
 *
 * 验证所有核心包的导入、Pipeline 基础创建、以及最简单的文档摄入+查询流程。
 */
import { describe, it, expect } from 'vitest';

describe('冒烟测试', () => {
  // --- 包导入验证 ---

  describe('所有包导入', () => {
    it('应能正常导入 @rag-sdk/core', async () => {
      const core = await import('@rag-sdk/core');
      expect(core.RAGPipeline).toBeDefined();
      expect(core.Logger).toBeDefined();
      expect(core.RetrievalRouter).toBeDefined();
      expect(core.CollectingMonitor).toBeDefined();
      expect(core.LoggingMonitor).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/llm', async () => {
      const llm = await import('@rag-sdk/llm');
      expect(llm.BaseLLMProvider).toBeDefined();
      expect(llm.OpenAIProvider).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/embedding', async () => {
      const embedding = await import('@rag-sdk/embedding');
      expect(embedding.BaseEmbeddingProvider).toBeDefined();
      expect(embedding.OpenAIEmbeddingProvider).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/storage', async () => {
      const storage = await import('@rag-sdk/storage');
      expect(storage.BaseVectorStore).toBeDefined();
      expect(storage.MemoryStore).toBeDefined();
      expect(storage.IndexManager).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/document', async () => {
      const doc = await import('@rag-sdk/document');
      expect(doc.FixedSizeChunker).toBeDefined();
      expect(doc.RecursiveChunker).toBeDefined();
      expect(doc.SemanticChunker).toBeDefined();
      expect(doc.MarkdownChunker).toBeDefined();
      expect(doc.TextLoader).toBeDefined();
      expect(doc.MarkdownLoader).toBeDefined();
      expect(doc.JSONLoader).toBeDefined();
      expect(doc.CSVLoader).toBeDefined();
      expect(doc.DocumentCleaner).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/retrieval', async () => {
      const retrieval = await import('@rag-sdk/retrieval');
      // 搜索策略
      expect(retrieval.VectorSearch).toBeDefined();
      expect(retrieval.KeywordSearch).toBeDefined();
      expect(retrieval.FusionSearch).toBeDefined();
      expect(retrieval.RRFSearch).toBeDefined();
      // 查询变换
      expect(retrieval.QueryRewriter).toBeDefined();
      expect(retrieval.MultiQueryExpander).toBeDefined();
      expect(retrieval.QueryDecomposer).toBeDefined();
      expect(retrieval.HyDETransformer).toBeDefined();
      // 后处理
      expect(retrieval.ThresholdPostProcessor).toBeDefined();
      expect(retrieval.RerankerPostProcessor).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/generation', async () => {
      const gen = await import('@rag-sdk/generation');
      expect(gen.StandardGenerator).toBeDefined();
      expect(gen.GroundedGenerator).toBeDefined();
      expect(gen.CitationGenerator).toBeDefined();
      expect(gen.SelfRAGGenerator).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/indexing', async () => {
      const indexing = await import('@rag-sdk/indexing');
      expect(indexing.IndexingPipeline).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/evaluation', async () => {
      const eval_ = await import('@rag-sdk/evaluation');
      expect(eval_.RecallEvaluator).toBeDefined();
      expect(eval_.PrecisionEvaluator).toBeDefined();
      expect(eval_.MRREvaluator).toBeDefined();
      expect(eval_.NDCGEvaluator).toBeDefined();
      expect(eval_.BLEUEvaluator).toBeDefined();
      expect(eval_.ROUGEEvaluator).toBeDefined();
    });

    it('应能正常导入 @rag-sdk/knowledge-graph', async () => {
      const kg = await import('@rag-sdk/knowledge-graph');
      expect(kg.EntityExtractor).toBeDefined();
      expect(kg.MemoryGraphStore).toBeDefined();
      expect(kg.GraphRetriever).toBeDefined();
      expect(kg.GraphBuilder).toBeDefined();
    });

    it('应能正常导入 rag-sdk 伞包', async () => {
      const ragSdk = await import('rag-sdk');
      expect(ragSdk.createSimpleRAG).toBeDefined();
      expect(ragSdk.createAdvancedRAG).toBeDefined();
      expect(ragSdk.PipelineBuilder).toBeDefined();
      expect(ragSdk.RAGPipeline).toBeDefined();
      expect(ragSdk.MemoryStore).toBeDefined();
      expect(ragSdk.FixedSizeChunker).toBeDefined();
    });
  });

  // --- Pipeline 基础创建 ---

  describe('Pipeline 基础创建', () => {
    it('应能使用默认配置创建 Pipeline', async () => {
      const { RAGPipeline } = await import('@rag-sdk/core');
      const { MemoryStore } = await import('@rag-sdk/storage');
      const { FixedSizeChunker } = await import('@rag-sdk/document');

      const pipeline = new RAGPipeline({
        llm: {
          chat: async () => '回答',
          chatStream: async function* () {},
          chatJson: async <T,>() => ({} as unknown as T),
        },
        embedding: {
          dimension: 3,
          embed: async () => [1, 2, 3],
          embedBatch: async () => [[1, 2, 3]],
        },
        store: new MemoryStore(),
        chunker: new FixedSizeChunker({ chunkSize: 500 }),
      });

      expect(pipeline).toBeDefined();
    });

    it('createSimpleRAG 应快速创建可用的 Pipeline', async () => {
      const { createSimpleRAG } = await import('rag-sdk');
      const { MemoryStore } = await import('@rag-sdk/storage');

      const pipeline = await createSimpleRAG({
        llm: {
          chat: async () => '简单回答',
          chatStream: async function* () {},
          chatJson: async <T,>() => ({} as unknown as T),
        },
        embedding: {
          dimension: 16,
          embed: async () => new Array(16).fill(0.1),
          embedBatch: async (texts: string[]) => texts.map(() => new Array(16).fill(0.1)),
        },
        store: new MemoryStore(),
        chunkSize: 200,
        overlap: 20,
        topK: 3,
      });

      expect(pipeline).toBeDefined();
    });

    it('createAdvancedRAG 应创建带查询变换和后处理的 Pipeline', async () => {
      const { createAdvancedRAG } = await import('rag-sdk');
      const { MemoryStore } = await import('@rag-sdk/storage');

      const pipeline = await createAdvancedRAG({
        llm: {
          chat: async () => '高级回答',
          chatStream: async function* () {},
          chatJson: async <T,>() => ({} as unknown as T),
        },
        embedding: {
          dimension: 16,
          embed: async () => new Array(16).fill(0.1),
          embedBatch: async (texts: string[]) => texts.map(() => new Array(16).fill(0.1)),
        },
        store: new MemoryStore(),
        chunkSize: 300,
        topK: 5,
        threshold: 0.3,
      });

      expect(pipeline).toBeDefined();
    });

    it('PipelineBuilder 应支持链式构建', async () => {
      const { PipelineBuilder } = await import('rag-sdk');
      const { MemoryStore } = await import('@rag-sdk/storage');
      const { FixedSizeChunker } = await import('@rag-sdk/document');

      const builder = new PipelineBuilder();
      const pipeline = builder
        .setLLM({
          chat: async () => '构建回答',
          chatStream: async function* () {},
          chatJson: async <T,>() => ({} as unknown as T),
        })
        .setEmbedding({
          dimension: 8,
          embed: async () => new Array(8).fill(0.1),
          embedBatch: async (texts: string[]) => texts.map(() => new Array(8).fill(0.1)),
        })
        .setStore(new MemoryStore())
        .setChunker(new FixedSizeChunker({ chunkSize: 500 }))
        .build();

      expect(pipeline).toBeDefined();
    });
  });

  // --- 简单文档摄入与查询 ---

  describe('文档摄入与查询', () => {
    it('应能摄入单文档并查询', async () => {
      const { RAGPipeline } = await import('@rag-sdk/core');
      const { MemoryStore } = await import('@rag-sdk/storage');
      const { FixedSizeChunker } = await import('@rag-sdk/document');

      let receivedContext = '';

      const pipeline = new RAGPipeline({
        llm: {
          chat: async (messages) => {
            receivedContext = JSON.stringify(messages);
            return '回答：这是一个关于测试的答案。';
          },
          chatStream: async function* () {},
          chatJson: async <T,>() => ({} as unknown as T),
        },
        embedding: {
          dimension: 4,
          embed: async () => [0.1, 0.2, 0.3, 0.4],
          embedBatch: async (texts: string[]) =>
            texts.map(() => [0.1, 0.2, 0.3, 0.4]),
        },
        store: new MemoryStore(),
        chunker: new FixedSizeChunker({ chunkSize: 500 }),
      });

      // 摄入文档
      await pipeline.ingest([
        {
          id: 'doc-smoke',
          content: '这是一份测试文档，包含项目的基本介绍信息。',
          metadata: { source: 'smoke-test' },
        },
      ]);

      // 查询
      const result = await pipeline.query('项目介绍');
      expect(result.answer).toBeDefined();
      expect(result.answer.length).toBeGreaterThan(0);
      expect(result.sources).toBeDefined();
      expect(result.sources.length).toBeGreaterThan(0);

      // 验证 LLM 收到了包含文档内容的上下文
      expect(receivedContext).toContain('测试文档');
    });

    it('应能摄入多文档并查询', async () => {
      const { RAGPipeline } = await import('@rag-sdk/core');
      const { MemoryStore } = await import('@rag-sdk/storage');
      const { FixedSizeChunker } = await import('@rag-sdk/document');

      let contextMessage = '';

      const pipeline = new RAGPipeline({
        llm: {
          chat: async (messages) => {
            const userMsg = messages.find((m) => m.role === 'user');
            contextMessage = typeof userMsg?.content === 'string' ? userMsg.content : '';
            return '多文档综合回答。';
          },
          chatStream: async function* () {},
          chatJson: async <T,>() => ({} as unknown as T),
        },
        embedding: {
          dimension: 8,
          embed: async () => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
          embedBatch: async (texts: string[]) =>
            texts.map(() => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
        },
        store: new MemoryStore(),
        chunker: new FixedSizeChunker({ chunkSize: 500 }),
      });

      await pipeline.ingest([
        { id: 'doc-a', content: '文档A：介绍系统架构设计。', metadata: {} },
        { id: 'doc-b', content: '文档B：描述数据流处理流程。', metadata: {} },
        { id: 'doc-c', content: '文档C：说明部署与运维方案。', metadata: {} },
      ]);

      const result = await pipeline.query('数据流处理');

      expect(result.answer).toBe('多文档综合回答。');
      // 上下文应包含相关内容
      expect(contextMessage.length).toBeGreaterThan(0);
    });

    it('空查询不应崩溃', async () => {
      const { RAGPipeline } = await import('@rag-sdk/core');
      const { MemoryStore } = await import('@rag-sdk/storage');
      const { FixedSizeChunker } = await import('@rag-sdk/document');

      const pipeline = new RAGPipeline({
        llm: {
          chat: async () => '空查询回答。',
          chatStream: async function* () {},
          chatJson: async <T,>() => ({} as unknown as T),
        },
        embedding: {
          dimension: 4,
          embed: async () => [0, 0, 0, 0],
          embedBatch: async () => [[0, 0, 0, 0]],
        },
        store: new MemoryStore(),
        chunker: new FixedSizeChunker({ chunkSize: 500 }),
      });

      await pipeline.ingest([
        { id: 'doc-empty', content: '一些内容。', metadata: {} },
      ]);

      // 空查询不应抛错
      await expect(pipeline.query('')).resolves.toBeDefined();
    });
  });

  // --- 中文内容处理 ---

  describe('中文内容处理', () => {
    it('应正确处理中文文档的摄入和查询', async () => {
      const { RAGPipeline } = await import('@rag-sdk/core');
      const { MemoryStore } = await import('@rag-sdk/storage');
      const { FixedSizeChunker } = await import('@rag-sdk/document');

      const pipeline = new RAGPipeline({
        llm: {
          chat: async () => '中文测试回答。',
          chatStream: async function* () {},
          chatJson: async <T,>() => ({} as unknown as T),
        },
        embedding: {
          dimension: 8,
          embed: async () => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
          embedBatch: async (texts: string[]) =>
            texts.map(() => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
        },
        store: new MemoryStore(),
        chunker: new FixedSizeChunker({ chunkSize: 500 }),
      });

      await pipeline.ingest([
        {
          id: 'doc-zh',
          content:
            '检索增强生成（RAG）是一种通过外部知识库增强大语言模型的技术。它可以有效减少模型幻觉，提高生成内容的准确性。',
          metadata: { lang: 'zh' },
        },
      ]);

      const result = await pipeline.query('什么是 RAG 技术');

      expect(result.answer).toBeDefined();
      expect(result.answer.length).toBeGreaterThan(0);
    });
  });

  // --- 文档切块器类型 ---

  describe('文档切块器', () => {
    it('FixedSizeChunker 应正确切分文档', async () => {
      const { FixedSizeChunker } = await import('@rag-sdk/document');

      const chunker = new FixedSizeChunker({ chunkSize: 100, overlap: 10 });
      const chunks = chunker.chunk({
        id: 'test',
        content: 'A'.repeat(250),
        metadata: {},
      });

      expect(chunks.length).toBeGreaterThan(1);

      // 每个 chunk 不应超过 chunkSize
      chunks.forEach((c) => {
        expect(c.content.length).toBeLessThanOrEqual(100);
      });
    });

    it('RecursiveChunker 应按段落合理切分', async () => {
      const { RecursiveChunker } = await import('@rag-sdk/document');

      const chunker = new RecursiveChunker();
      const chunks = chunker.chunk(
        {
          id: 'test-recursive',
          content: '第一段\n\n第二段\n\n第三段',
          metadata: {},
        },
        { chunkSize: 50, overlap: 10 },
      );

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
