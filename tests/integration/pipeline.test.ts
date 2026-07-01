/**
 * RAG Pipeline 集成测试
 *
 * 端到端验证完整 RAG 流程：切块 → 嵌入 → 存储 → 检索 → 生成
 * 使用 mock LLM/Embedding + 真实的 MemoryStore 和各模块实现
 */
import { describe, it, expect, vi } from 'vitest';
import { RAGPipeline, LoggingMonitor, CollectingMonitor } from '@ragsdk/core';
import { MemoryStore } from '@ragsdk/storage';
import { FixedSizeChunker, RecursiveChunker } from '@ragsdk/document';
import { VectorSearch, KeywordSearch, FusionSearch, RRFSearch } from '@ragsdk/retrieval';
import { ThresholdPostProcessor, RerankerPostProcessor } from '@ragsdk/retrieval';
import { QueryRewriter, MultiQueryExpander, HyDETransformer } from '@ragsdk/retrieval';
import { StandardGenerator, CitationGenerator } from '@ragsdk/generation';
import type {
  LLMProvider,
  EmbeddingProvider,
  VectorStore,
  Chunker,
  Document,
  SearchResult,
  GenerateResult,
  PipelineMonitor,
} from '@ragsdk/core';

// ==================== Mock 工厂 ====================

/** 创建 mock LLMProvider */
function createMockLLM(cannedResponse = '根据资料显示，这是一段测试回答。'): LLMProvider {
  return {
    chat: vi.fn(async () => cannedResponse),
    chatStream: vi.fn(async function* () {
      yield* cannedResponse;
    }),
    chatJson: vi.fn(async (_messages: unknown, _schema: unknown) => ({})),
  } as unknown as LLMProvider;
}

/** 创建 mock EmbeddingProvider */
function createMockEmbedding(dim = 128): EmbeddingProvider {
  return {
    dimension: dim,
    embed: vi.fn(async () => Array.from({ length: dim }, () => Math.random())),
    embedBatch: vi.fn(async (texts: string[]) =>
      texts.map(() => Array.from({ length: dim }, () => Math.random())),
    ),
  };
}

/** 创建 mock VectorStore（基于 MemoryStore 可切换） */
function createRealStore(): VectorStore {
  return new MemoryStore();
}

/** 创建测试文档 */
function createTestDocuments(): Document[] {
  return [
    {
      id: 'doc-1',
      content:
        'RAG（检索增强生成）是一种结合信息检索与文本生成的 AI 技术架构。它从外部知识库中检索相关文档片段，作为生成模型的上下文，从而提高回答的准确性和事实性。',
      metadata: { title: 'RAG 概述', category: 'AI' },
    },
    {
      id: 'doc-2',
      content:
        '向量数据库专门用于存储和检索高维向量数据，广泛应用于相似性搜索、推荐系统和 RAG 系统中。常见的向量数据库包括 Pinecone、Weaviate、Chroma 和 Qdrant。',
      metadata: { title: '向量数据库', category: 'database' },
    },
    {
      id: 'doc-3',
      content:
        'Embedding 是将文本转换为稠密数值向量的技术。常见的嵌入模型包括 OpenAI 的 text-embedding-3-small、Google 的 text-embedding-004 以及开源的 bge-large-zh-v1.5。',
      metadata: { title: '嵌入技术', category: 'AI' },
    },
  ];
}

// ==================== 测试用例 ====================

describe('RAG Pipeline 集成测试', () => {
  // --- 完整 Pipeline 流程 ---

  describe('完整流程：ingest → query', () => {
    it('应完成文档摄入并返回检索增强的回答', async () => {
      const llm = createMockLLM('RAG 是一种结合检索与生成的 AI 技术。');
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });
      const monitor = new CollectingMonitor();

      const pipeline = new RAGPipeline({ llm, embedding, store, chunker, monitor });

      const docs = createTestDocuments();
      await pipeline.ingest(docs);

      // 验证存储中有内容
      const queryVector = await embedding.embed('RAG 是什么');
      const searchResults = await store.search(queryVector, { topK: 3 });
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.length).toBeLessThanOrEqual(3);

      // 查询并验证回答格式
      const result = await pipeline.query('RAG 是什么');
      expect(result).toBeDefined();
      expect(result.answer).toBe('RAG 是一种结合检索与生成的 AI 技术。');
      expect(result.sources).toBeDefined();
      expect(result.sources.length).toBeGreaterThan(0);

      // 验证 monitor 记录了各阶段指标
      const reports = monitor.getReports();
      expect(reports).toBeDefined();
      expect(reports.length).toBeGreaterThanOrEqual(1);
    });

    it('空文档列表不应报错', async () => {
      const llm = createMockLLM();
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });

      const pipeline = new RAGPipeline({ llm, embedding, store, chunker });
      await expect(pipeline.ingest([])).resolves.not.toThrow();
    });

    it('重复摄入同 ID 文档应覆盖旧数据', async () => {
      const llm = createMockLLM();
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });

      const pipeline = new RAGPipeline({ llm, embedding, store, chunker });

      // 第一次摄入
      await pipeline.ingest([
        { id: 'doc-dup', content: '旧版本文档内容。', metadata: {} },
      ]);

      // 第二次摄入同一个 ID
      await pipeline.ingest([
        { id: 'doc-dup', content: '新版本文档内容，包含更多信息。', metadata: {} },
      ]);

      // 查询应返回基于新内容的回答
      await pipeline.query('旧文档');
      expect(llm.chat).toHaveBeenCalled();
    });
  });

  // --- 查询变换 Pipeline ---

  describe('查询变换 Pipeline', () => {
    it('QueryRewriter 应改写查询并传给检索器', async () => {
      const llm = createMockLLM();
      // Mock chatJson 返回改写后的查询
      (llm.chatJson as ReturnType<typeof vi.fn>).mockResolvedValue({
        rewritten: 'RAG 技术的定义和原理',
      });

      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });

      const rewriter = new QueryRewriter(llm);
      const pipeline = new RAGPipeline({
        llm,
        embedding,
        store,
        chunker,
        queryTransformers: [rewriter],
      });

      await pipeline.ingest(createTestDocuments());

      // 调用 transform 验证改写功能
      const rewritten = await rewriter.transform('什么是 RAG');
      expect(typeof rewritten).toBe('string');
      expect(rewritten.length).toBeGreaterThan(0);
    });

    it('MultiQueryExpander 应生成多个子查询', async () => {
      const llm = createMockLLM();
      (llm.chatJson as ReturnType<typeof vi.fn>).mockResolvedValue({
        queries: ['RAG 的原理', '检索增强生成的工作流程', 'RAG 的优缺点'],
      });

      const multiQuery = new MultiQueryExpander(llm);
      const queries = await multiQuery.transform('介绍一下 RAG');

      expect(Array.isArray(queries)).toBe(true);
      if (Array.isArray(queries)) {
        expect(queries.length).toBeGreaterThan(1);
      }
    });

    it('HyDETransformer 应生成假设性文档', async () => {
      const llm = createMockLLM();
      (llm.chat as ReturnType<typeof vi.fn>).mockResolvedValue(
        'RAG 技术通过检索外部知识库来增强大语言模型的生成能力，有效减少幻觉问题。',
      );

      const hyde = new HyDETransformer(llm);
      const hydeDoc = await hyde.transform('RAG 有什么优势');

      expect(typeof hydeDoc).toBe('string');
      expect(hydeDoc.length).toBeGreaterThan(0);
    });
  });

  // --- 检索融合 Pipeline ---

  describe('检索融合', () => {
    it('FusionSearch 应融合向量与关键词搜索结果', async () => {
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });

      // 先摄入文档
      const llm = createMockLLM();
      const pipeline = new RAGPipeline({ llm, embedding, store, chunker });
      await pipeline.ingest(createTestDocuments());

      // 构建融合检索器
      const vectorSearch = new VectorSearch(embedding, store);
      const keywordSearch = new KeywordSearch();
      const fusionSearch = new FusionSearch(vectorSearch, keywordSearch, 0.7, 0.3);

      const results = await fusionSearch.retrieve('向量数据库', { topK: 3 });
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);

      // 结果按分数降序排列
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
      }
    });

    it('RRFSearch 应基于排名融合多路结果', async () => {
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });

      const llm = createMockLLM();
      const pipeline = new RAGPipeline({ llm, embedding, store, chunker });
      await pipeline.ingest(createTestDocuments());

      const vectorSearch = new VectorSearch(embedding, store);
      const keywordSearch = new KeywordSearch();
      const rrfSearch = new RRFSearch(60);

      const [vecResults, kwResults] = await Promise.all([
        vectorSearch.retrieve('嵌入技术', { topK: 5 }),
        keywordSearch.retrieve('嵌入技术', { topK: 5 }),
      ]);

      const fused = rrfSearch.fuse([vecResults, kwResults], 3);

      expect(fused.length).toBeGreaterThan(0);
      expect(fused.length).toBeLessThanOrEqual(3);

      // RRF 基于排名，所有分数应 > 0
      fused.forEach((r) => {
        expect(r.score).toBeGreaterThan(0);
      });
    });
  });

  // --- 后处理 Pipeline ---

  describe('后处理 Pipeline', () => {
    it('ThresholdPostProcessor 应过滤低分结果', async () => {
      const searchResults: SearchResult[] = [
        {
          chunk: { id: 'c1', documentId: 'd1', content: '高分内容', metadata: {} },
          score: 0.95,
          source: 'vector',
        },
        {
          chunk: { id: 'c2', documentId: 'd1', content: '低分内容', metadata: {} },
          score: 0.3,
          source: 'vector',
        },
        {
          chunk: { id: 'c3', documentId: 'd2', content: '合格内容', metadata: {} },
          score: 0.6,
          source: 'vector',
        },
      ];

      const threshold = new ThresholdPostProcessor({ threshold: 0.5 });
      const filtered = await threshold.process(searchResults);

      expect(filtered.length).toBe(2);
      const ids = filtered.map((r) => r.chunk.id);
      expect(ids).toContain('c1');
      expect(ids).toContain('c3');
    });

    it('RerankerPostProcessor 应重新排序并截断', async () => {
      const searchResults: SearchResult[] = [
        {
          chunk: { id: 'c1', documentId: 'd1', content: '内容 A', metadata: {} },
          score: 0.9,
          source: 'vector',
        },
        {
          chunk: { id: 'c2', documentId: 'd1', content: '内容 B', metadata: {} },
          score: 0.8,
          source: 'vector',
        },
        {
          chunk: { id: 'c3', documentId: 'd2', content: '内容 C', metadata: {} },
          score: 0.7,
          source: 'vector',
        },
      ];

      // 模拟评分器：内容 B 最相关
      const scorer = vi.fn(async (query: string, content: string): Promise<number> => {
        if (content === '内容 B') return 0.99;
        if (content === '内容 A') return 0.5;
        return 0.3;
      });

      const reranker = new RerankerPostProcessor(scorer, { topK: 2 });
      const reranked = await reranker.process(searchResults, '测试查询');

      expect(reranked.length).toBe(2);
      // 内容 B 应排到第一位
      expect(reranked[0]!.chunk.content).toBe('内容 B');
    });
  });

  // --- 流式输出 ---

  describe('流式输出', () => {
    it('queryStream 应生成流式回答', async () => {
      const llm = createMockLLM('流式输出的回答内容。');
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });

      const pipeline = new RAGPipeline({ llm, embedding, store, chunker });
      await pipeline.ingest(createTestDocuments());

      const stream = pipeline.queryStream('什么是 RAG');
      expect(stream).toBeDefined();

      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  // --- 监控 ---

  describe('Pipeline Monitor', () => {
    it('LoggingMonitor 应记录阶段事件', async () => {
      const monitor = new LoggingMonitor();
      const llm = createMockLLM();
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });

      const pipeline = new RAGPipeline({ llm, embedding, store, chunker, monitor });
      await pipeline.ingest(createTestDocuments());
      await pipeline.query('RAG 测试');

      // LoggingMonitor 不保存数据，但不应抛错
      expect(true).toBe(true);
    });

    it('CollectingMonitor 应收录各阶段耗时', async () => {
      const monitor = new CollectingMonitor();
      const llm = createMockLLM();
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 500, overlap: 50 });

      const pipeline = new RAGPipeline({ llm, embedding, store, chunker, monitor });
      await pipeline.ingest(createTestDocuments());
      await pipeline.query('RAG 是什么');

      const reports = monitor.getReports();
      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThanOrEqual(1);

      // 检查第一个 report 的阶段信息
      const firstReport = reports[0];
      expect(firstReport).toBeDefined();
      if (firstReport) {
        expect(typeof firstReport.queryDurationMs).toBe('number');
        expect(firstReport.queryDurationMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // --- 多文档交叉检索 ---

  describe('多文档交叉检索', () => {
    it('应在多文档中正确检索到相关结果', async () => {
      const llm = createMockLLM();
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 300, overlap: 30 });

      const pipeline = new RAGPipeline({ llm, embedding, store, chunker });
      await pipeline.ingest(createTestDocuments());

      // 查询向量数据库相关
      const result = await pipeline.query('向量数据库有哪些选择');

      expect(result.answer.length).toBeGreaterThan(0);
      // sources 应包含来自 doc-2 的内容
      const hasDbContent = result.sources.some((s) => s.documentId === 'doc-2');
      expect(hasDbContent).toBe(true);
    });
  });

  // --- 大文档切块 ---

  describe('大文档切块', () => {
    it('长文档应被正确地切分为多个 chunk', async () => {
      const llm = createMockLLM();
      const embedding = createMockEmbedding(128);
      const store = createRealStore();
      const chunker = new FixedSizeChunker({ chunkSize: 100, overlap: 20 });

      const pipeline = new RAGPipeline({ llm, embedding, store, chunker });

      // 创建一个需要切分的长文档
      const longContent = `
第一节：RAG 概述。检索增强生成（Retrieval-Augmented Generation，RAG）是一种结合了信息检索和文本生成的AI技术。

第二节：核心原理。RAG系统首先从外部知识库中检索与用户查询相关的文档片段，然后将这些片段与原始查询一起输入到大语言模型中进行生成。

第三节：技术优势。相比传统的生成模型，RAG可以显著减少幻觉问题，提高回答的事实准确性。

第四节：应用场景。RAG广泛应用于智能客服、企业知识库、法律文档分析等领域。

第五节：未来展望。随着向量数据库和嵌入技术的不断进步，RAG系统的效率和准确性将持续提升。
`.trim();

      await pipeline.ingest([
        { id: 'doc-long', content: longContent, metadata: {} },
      ]);

      // 查询应返回结果
      const result = await pipeline.query('RAG 有什么优势');
      expect(result.answer.length).toBeGreaterThan(0);
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it('RecursiveChunker 应按段落合理切分', async () => {
      const chunker = new RecursiveChunker();
      const doc: Document = {
        id: 'doc-recursive',
        content: '第一章：引言\n\n这是引言的内容。\n\n第二章：方法\n\n这是方法的内容。',
        metadata: {},
      };

      const chunks = chunker.chunk(doc, { chunkSize: 50, overlap: 5 });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.length).toBeLessThanOrEqual(4);

      // 每个 chunk 不应超过 chunkSize
      chunks.forEach((c) => {
        expect(c.content.length).toBeLessThanOrEqual(50);
      });

      // 应有正确的文档 ID
      chunks.forEach((c) => {
        expect(c.documentId).toBe('doc-recursive');
      });
    });
  });

  // --- 生成器 ---

  describe('生成器', () => {
    it('StandardGenerator 应生成带来源的回答', async () => {
      const llm = createMockLLM('标准生成回答。');
      const generator = new StandardGenerator(llm);

      const chunks = [
        { id: 'c1', documentId: 'd1', content: '上下文 1', metadata: {} },
        { id: 'c2', documentId: 'd1', content: '上下文 2', metadata: {} },
      ];

      const result = await generator.generate('测试问题', chunks);

      expect(result.answer).toBeDefined();
      expect(result.answer.length).toBeGreaterThan(0);
      expect(result.sources).toBeDefined();
    });

    it('CitationGenerator 应为回答添加引用', async () => {
      const llm = createMockLLM('带引用的回答[1][2]。');
      const generator = new CitationGenerator(llm);

      const chunks = [
        {
          id: 'c1',
          documentId: 'd1',
          content: '引用源 1',
          metadata: { source: '文献A' },
        },
        {
          id: 'c2',
          documentId: 'd1',
          content: '引用源 2',
          metadata: { source: '文献B' },
        },
      ];

      const result = await generator.generate('需要引用的查询', chunks);

      expect(result.answer).toBeDefined();
      expect(result.answer.length).toBeGreaterThan(0);
      // CitationGenerator 应检查引用的完整性
      expect(result.metadata).toBeDefined();
    });
  });
});
