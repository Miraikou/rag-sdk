import type {
  Chunk,
  Document,
  GenerateResult,
  Generator,
  Message,
  Pipeline,
  PipelineConfig,
  PipelineMonitor,
  PipelineReport,
  Retriever,
  SearchResult,
  StageMetrics,
  TokenBudgetManager,
} from './types';
import { Logger } from './logger';

const logger = new Logger('Pipeline');

/** 默认向量检索器 */
class DefaultRetriever implements Retriever {
  constructor(
    private embedding: import('./types').EmbeddingProvider,
    private store: import('./types').VectorStore,
  ) {}

  async retrieve(
    query: string,
    options?: { topK?: number; filter?: Record<string, unknown> },
  ): Promise<SearchResult[]> {
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
  private monitor?: PipelineMonitor;
  private tokenBudget?: TokenBudgetManager;

  constructor(config: PipelineConfig) {
    if (!config.llm) throw new Error('PipelineConfig.llm is required');
    if (!config.embedding) throw new Error('PipelineConfig.embedding is required');
    if (!config.store) throw new Error('PipelineConfig.store is required');
    if (!config.chunker) throw new Error('PipelineConfig.chunker is required');

    this.config = config;

    // 默认检索器：基于 store 的向量检索
    this.retriever = config.retriever ?? new DefaultRetriever(config.embedding, config.store);

    // 默认生成器：基于 LLM
    this.generator = config.generator ?? this.createDefaultGenerator();
    this.monitor = config.monitor;
    this.tokenBudget = config.tokenBudget;
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
    const queryStart = Date.now();
    const stageMetrics: StageMetrics[] = [];

    // 1. 查询变换
    const queries = await this.measure('transform', stageMetrics, async () => {
      let qs: string[] = [question];
      for (const transformer of this.config.queryTransformers ?? []) {
        const results: string[] = [];
        for (const q of qs) {
          const transformed = await transformer.transform(q);
          if (Array.isArray(transformed)) {
            results.push(...transformed);
          } else {
            results.push(transformed);
          }
        }
        qs = results;
      }
      return qs;
    });

    // 2. 检索（对每个 query 分别检索，合并去重）
    const allResults = await this.measure('retrieve', stageMetrics, async () => {
      const results: SearchResult[] = [];
      const seenIds = new Set<string>();
      for (const q of queries) {
        const qResults = await this.retriever.retrieve(q);
        for (const result of qResults) {
          if (!seenIds.has(result.chunk.id)) {
            seenIds.add(result.chunk.id);
            results.push(result);
          }
        }
      }
      logger.info(`Retrieved ${results.length} unique results`);
      return results;
    });

    // 3. 后处理
    const processedResults = await this.measure('postProcess', stageMetrics, async () => {
      let processed = allResults;
      for (const processor of this.config.postProcessors ?? []) {
        processed = await processor.process(processed, question);
      }
      logger.info(`After post-processing: ${processed.length} results`);
      return processed;
    });

    // 4. Token 预算截断
    let chunks = processedResults.map((r) => r.chunk);
    if (this.tokenBudget) {
      chunks = this.tokenBudget.truncateContext(chunks);
      logger.info(`After token budget truncation: ${chunks.length} chunks`);
    }

    // 5. 生成
    const result = await this.measure('generate', stageMetrics, async () => {
      const res = await this.generator.generate(question, chunks);
      logger.info(`Generated answer (${res.answer.length} chars)`);
      return res;
    });

    // 发送性能报告
    if (this.monitor) {
      const report: PipelineReport = {
        queryDurationMs: Date.now() - queryStart,
        stages: stageMetrics,
      };
      this.monitor.onQueryComplete(report);
    }

    return result;
  }

  /**
   * 流式查询 — 变换 → 检索 → 后处理 → 流式生成
   *
   * 前三个阶段与 query() 相同（非流式），
   * 生成阶段使用 Generator.generateStream()（如果支持）进行真正的流式输出。
   */
  async *queryStream(question: string): AsyncIterable<string> {
    logger.info(`QueryStream: "${question}"`);
    const queryStart = Date.now();
    const stageMetrics: StageMetrics[] = [];

    // 1. 查询变换
    const queries = await this.measure('transform', stageMetrics, async () => {
      let qs: string[] = [question];
      for (const transformer of this.config.queryTransformers ?? []) {
        const results: string[] = [];
        for (const q of qs) {
          const transformed = await transformer.transform(q);
          if (Array.isArray(transformed)) {
            results.push(...transformed);
          } else {
            results.push(transformed);
          }
        }
        qs = results;
      }
      return qs;
    });

    // 2. 检索
    const allResults = await this.measure('retrieve', stageMetrics, async () => {
      const results: SearchResult[] = [];
      const seenIds = new Set<string>();
      for (const q of queries) {
        const qResults = await this.retriever.retrieve(q);
        for (const result of qResults) {
          if (!seenIds.has(result.chunk.id)) {
            seenIds.add(result.chunk.id);
            results.push(result);
          }
        }
      }
      return results;
    });

    // 3. 后处理
    const processedResults = await this.measure('postProcess', stageMetrics, async () => {
      let processed = allResults;
      for (const processor of this.config.postProcessors ?? []) {
        processed = await processor.process(processed, question);
      }
      return processed;
    });

    // 4. Token 预算截断
    let chunks = processedResults.map((r) => r.chunk);
    if (this.tokenBudget) {
      chunks = this.tokenBudget.truncateContext(chunks);
    }

    // 5. 流式生成（生成阶段的计时在流结束后统计）
    this.monitor?.onStageStart('generate');
    const genStart = Date.now();

    if (this.generator.generateStream) {
      yield* this.generator.generateStream(question, chunks);
    } else {
      // 降级：完整生成后逐字符 yield
      const result = await this.generator.generate(question, chunks);
      yield* result.answer;
    }

    const genMetrics: StageMetrics = {
      stage: 'generate',
      durationMs: Date.now() - genStart,
    };
    stageMetrics.push(genMetrics);
    this.monitor?.onStageEnd('generate', genMetrics);

    // 发送性能报告
    if (this.monitor) {
      const report: PipelineReport = {
        queryDurationMs: Date.now() - queryStart,
        stages: stageMetrics,
      };
      this.monitor.onQueryComplete(report);
    }
  }

  /**
   * 带性能计量的阶段执行辅助方法
   *
   * @param stage - 阶段名称
   * @param metricsCollector - 指标收集数组
   * @param fn - 要执行的异步函数
   * @returns 函数返回值
   */
  private async measure<T>(
    stage: string,
    metricsCollector: StageMetrics[],
    fn: () => Promise<T>,
  ): Promise<T> {
    this.monitor?.onStageStart(stage);
    const start = Date.now();

    const result = await fn();

    const durationMs = Date.now() - start;
    const metrics: StageMetrics = { stage, durationMs };

    // 为检索阶段添加结果数量
    if (Array.isArray(result)) {
      metrics.resultCount = result.length;
    }

    metricsCollector.push(metrics);
    this.monitor?.onStageEnd(stage, metrics);

    return result;
  }

  private createDefaultGenerator(): Generator {
    const llm = this.config.llm;
    return {
      async generate(query: string, chunks: Chunk[]): Promise<GenerateResult> {
        const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');

        const messages: Message[] = [
          {
            role: 'system',
            content:
              '你是一个知识库助手。请严格根据以下参考资料回答用户问题。如果资料不足以回答，请明确说明。',
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
