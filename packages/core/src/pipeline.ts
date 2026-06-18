import type {
  Chunk,
  Document,
  GenerateResult,
  Generator,
  Message,
  Pipeline,
  PipelineConfig,
  PostProcessor,
  QueryTransformer,
  Retriever,
  SearchResult,
} from './types';
import { Logger } from './logger';

const logger = new Logger('Pipeline');

/** 默认生成器：基于 LLM 的标准答案生成 */
class DefaultGenerator implements Generator {
  async generate(
    query: string,
    chunks: Chunk[],
  ): Promise<GenerateResult> {
    // 此方法需要 LLM，在 RAGPipeline 中会被覆盖
    throw new Error('DefaultGenerator requires LLM - use RAGPipeline');
  }
}

/** 默认向量检索器 */
class DefaultRetriever implements Retriever {
  constructor(
    private embedding: import('./types').EmbeddingProvider,
    private store: import('./types').VectorStore,
  ) {}

  async retrieve(query: string, options?: { topK?: number; filter?: Record<string, unknown> }): Promise<SearchResult[]> {
    const queryVector = await this.embedding.embed(query);
    return this.store.search(queryVector, {
      topK: options?.topK ?? 5,
      filter: options?.filter,
    });
  }
}

/** RAG Pipeline — 串联文档处理、检索、生成的核心编排器 */
export class RAGPipeline implements Pipeline {
  private config: PipelineConfig;
  private retriever: Retriever;
  private generator: Generator;

  constructor(config: PipelineConfig) {
    this.config = config;

    // 默认检索器：基于 store 的向量检索
    this.retriever = config.retriever ?? new DefaultRetriever(config.embedding, config.store);

    // 默认生成器：基于 LLM
    this.generator = config.generator ?? this.createDefaultGenerator();
  }

  /**
   * 摄入文档：切块 → 嵌入 → 存储
   */
  async ingest(documents: Document[]): Promise<void> {
    logger.info(`Ingesting ${documents.length} documents`);

    // 1. 切块
    const allChunks: Chunk[] = [];
    for (const doc of documents) {
      const chunks = this.config.chunker.chunk(doc);
      allChunks.push(...chunks);
    }
    logger.info(`Chunked into ${allChunks.length} chunks`);

    // 2. 嵌入
    const texts = allChunks.map((c) => c.content);
    const embeddings = await this.config.embedding.embedBatch(texts);
    for (let i = 0; i < allChunks.length; i++) {
      allChunks[i]!.embedding = embeddings[i];
    }
    logger.info(`Embedded ${allChunks.length} chunks (dim=${this.config.embedding.dimension})`);

    // 3. 存储
    await this.config.store.upsert(allChunks);
    logger.info(`Stored ${allChunks.length} chunks`);
  }

  /**
   * 查询：查询变换 → 检索 → 后处理 → 生成
   */
  async query(question: string): Promise<GenerateResult> {
    logger.info(`Query: "${question}"`);

    // 1. 查询变换
    let queries: string[] = [question];
    for (const transformer of this.config.queryTransformers ?? []) {
      const results: string[] = [];
      for (const q of queries) {
        const transformed = await transformer.transform(q);
        if (Array.isArray(transformed)) {
          results.push(...transformed);
        } else {
          results.push(transformed);
        }
      }
      queries = results;
    }

    // 2. 检索（对每个 query 分别检索，合并去重）
    const allResults: SearchResult[] = [];
    const seenIds = new Set<string>();
    for (const q of queries) {
      const results = await this.retriever.retrieve(q);
      for (const result of results) {
        if (!seenIds.has(result.chunk.id)) {
          seenIds.add(result.chunk.id);
          allResults.push(result);
        }
      }
    }
    logger.info(`Retrieved ${allResults.length} unique results`);

    // 3. 后处理
    let processedResults = allResults;
    for (const processor of this.config.postProcessors ?? []) {
      processedResults = await processor.process(processedResults, question);
    }
    logger.info(`After post-processing: ${processedResults.length} results`);

    // 4. 生成
    const chunks = processedResults.map((r) => r.chunk);
    const result = await this.generator.generate(question, chunks);
    logger.info(`Generated answer (${result.answer.length} chars)`);

    return result;
  }

  /**
   * 流式查询
   */
  async *queryStream(question: string): AsyncIterable<string> {
    // 简化实现：先完成完整查询，再逐字符 yield
    // 实际生产中应使用 LLM 的流式 API
    const result = await this.query(question);
    for (const char of result.answer) {
      yield char;
    }
  }

  private createDefaultGenerator(): Generator {
    const llm = this.config.llm;
    return {
      async generate(query: string, chunks: Chunk[]): Promise<GenerateResult> {
        const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

        const messages: Message[] = [
          {
            role: 'system',
            content: '你是一个知识库助手。请严格根据以下参考资料回答用户问题。如果资料不足以回答，请明确说明。',
          },
          {
            role: 'user',
            content: `参考资料：\n${context}\n\n用户问题：${query}`,
          },
        ];

        const answer = await llm.chat(messages);
        const sources = chunks.map((c) => ({
          chunkId: c.id,
          documentId: c.documentId,
          content: c.content,
          metadata: c.metadata,
        }));

        return { answer, sources, metadata: {} };
      },
    };
  }
}
