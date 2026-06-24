import type {
  Chunker,
  EmbeddingProvider,
  Generator,
  LLMProvider,
  PipelineConfig,
  PipelineMonitor,
  PostProcessor,
  QueryTransformer,
  Retriever,
  TokenBudgetManager,
  VectorStore,
} from '@rag-sdk/core';
import { RAGPipeline } from '@rag-sdk/core';

/**
 * Pipeline 流式构建器
 *
 * 提供链式 API 逐步配置 Pipeline 各组件，
 * 在 build() 时校验必填字段并构建 RAGPipeline。
 *
 * @example
 * ```ts
 * const pipeline = new PipelineBuilder()
 *   .setLLM(llm)
 *   .setEmbedding(embedding)
 *   .setStore(store)
 *   .setChunker(chunker)
 *   .addQueryTransformer(new QueryRewriter(llm))
 *   .addPostProcessor(new ThresholdPostProcessor())
 *   .setMonitor(new LoggingMonitor())
 *   .build()
 * ```
 */
export class PipelineBuilder {
  private llm?: LLMProvider;
  private embeddingProvider?: EmbeddingProvider;
  private vectorStore?: VectorStore;
  private chunkerInstance?: Chunker;
  private queryTransformers: QueryTransformer[] = [];
  private retrieverInstance?: Retriever;
  private postProcessors: PostProcessor[] = [];
  private generatorInstance?: Generator;
  private monitorInstance?: PipelineMonitor;
  private tokenBudgetInstance?: TokenBudgetManager;

  /**
   * 设置 LLM 提供商
   *
   * @param llm - LLM 提供商实例
   */
  setLLM(llm: LLMProvider): this {
    this.llm = llm;
    return this;
  }

  /**
   * 设置嵌入提供商
   *
   * @param embedding - 嵌入提供商实例
   */
  setEmbedding(embedding: EmbeddingProvider): this {
    this.embeddingProvider = embedding;
    return this;
  }

  /**
   * 设置向量存储
   *
   * @param store - 向量存储实例
   */
  setStore(store: VectorStore): this {
    this.vectorStore = store;
    return this;
  }

  /**
   * 设置切块策略
   *
   * @param chunker - 切块器实例
   */
  setChunker(chunker: Chunker): this {
    this.chunkerInstance = chunker;
    return this;
  }

  /**
   * 添加查询变换器（可多次调用以添加多个变换器）
   *
   * @param transformer - 查询变换器实例
   */
  addQueryTransformer(transformer: QueryTransformer): this {
    this.queryTransformers.push(transformer);
    return this;
  }

  /**
   * 设置自定义检索器
   *
   * 不设置时使用默认的向量检索器。
   *
   * @param retriever - 检索器实例
   */
  setRetriever(retriever: Retriever): this {
    this.retrieverInstance = retriever;
    return this;
  }

  /**
   * 添加后处理器（可多次调用以添加多个后处理器）
   *
   * @param processor - 后处理器实例
   */
  addPostProcessor(processor: PostProcessor): this {
    this.postProcessors.push(processor);
    return this;
  }

  /**
   * 设置自定义生成器
   *
   * 不设置时使用默认的 LLM 生成器。
   *
   * @param generator - 生成器实例
   */
  setGenerator(generator: Generator): this {
    this.generatorInstance = generator;
    return this;
  }

  /**
   * 设置性能监控器
   *
   * @param monitor - 监控器实例
   */
  setMonitor(monitor: PipelineMonitor): this {
    this.monitorInstance = monitor;
    return this;
  }

  /**
   * 设置 Token 预算管理器
   *
   * @param budget - Token 预算管理器实例
   */
  setTokenBudget(budget: TokenBudgetManager): this {
    this.tokenBudgetInstance = budget;
    return this;
  }

  /**
   * 构建 RAGPipeline
   *
   * 校验必填字段（llm、embedding、store、chunker）后创建 Pipeline。
   *
   * @returns 配置好的 RAGPipeline 实例
   * @throws 缺少必填字段时抛出错误
   */
  build(): RAGPipeline {
    if (!this.llm) throw new Error('PipelineBuilder: llm is required (call setLLM)');
    if (!this.embeddingProvider)
      throw new Error('PipelineBuilder: embedding is required (call setEmbedding)');
    if (!this.vectorStore) throw new Error('PipelineBuilder: store is required (call setStore)');
    if (!this.chunkerInstance)
      throw new Error('PipelineBuilder: chunker is required (call setChunker)');

    const config: PipelineConfig = {
      llm: this.llm,
      embedding: this.embeddingProvider,
      store: this.vectorStore,
      chunker: this.chunkerInstance,
    };

    if (this.queryTransformers.length > 0) {
      config.queryTransformers = this.queryTransformers;
    }
    if (this.retrieverInstance) {
      config.retriever = this.retrieverInstance;
    }
    if (this.postProcessors.length > 0) {
      config.postProcessors = this.postProcessors;
    }
    if (this.generatorInstance) {
      config.generator = this.generatorInstance;
    }
    if (this.monitorInstance) {
      config.monitor = this.monitorInstance;
    }
    if (this.tokenBudgetInstance) {
      config.tokenBudget = this.tokenBudgetInstance;
    }

    return new RAGPipeline(config);
  }
}
