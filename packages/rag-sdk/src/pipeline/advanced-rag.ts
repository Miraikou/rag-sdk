import type { PipelineConfig, PostProcessor } from '@ragsdk/core';
import { RAGPipeline } from '@ragsdk/core';

/**
 * Advanced RAG 预设选项
 *
 * 基于 Gao et al. (2024) "RAG for LLMs" Survey 的 Advanced RAG 范式：
 * 预检索优化（查询改写） + 混合检索（向量 + 关键词融合） + 后检索精炼（阈值过滤 + 重排序）
 */
export interface AdvancedRAGOptions {
  /** LLM 提供商 */
  llm: PipelineConfig['llm'];
  /** 嵌入提供商 */
  embedding: PipelineConfig['embedding'];
  /** 向量存储 */
  store: PipelineConfig['store'];
  /** 切块大小，默认 500 */
  chunkSize?: number;
  /** 切块重叠，默认 50 */
  overlap?: number;
  /** 检索数量，默认 10 */
  topK?: number;
  /** 分数阈值，默认 0.5 */
  threshold?: number;
  /** 向量权重（融合检索中），默认 0.7 */
  vectorWeight?: number;
  /** 关键词权重（融合检索中），默认 0.3 */
  keywordWeight?: number;
  /** 可选的自定义重排序评分器 */
  rerankerScorer?: (query: string, content: string) => Promise<number>;
  /** 重排序后保留数量，默认 5 */
  rerankTopK?: number;
}

/**
 * 创建 Advanced RAG Pipeline
 *
 * 配置：
 * 1. 查询改写（QueryRewriter）— 预检索优化
 * 2. 混合检索（FusionSearch）— 向量 + 关键词加权融合
 * 3. 阈值过滤（ThresholdPostProcessor）— 去除低质量结果
 * 4. 可选重排序（RerankerPostProcessor）— 后检索精炼
 *
 * @param options - Advanced RAG 配置选项
 * @returns 配置好的 RAGPipeline 实例
 *
 * @example
 * ```ts
 * const rag = await createAdvancedRAG({
 *   llm: new OpenAIProvider({ apiKey: '...' }),
 *   embedding: new OpenAIEmbeddingProvider({ apiKey: '...' }),
 *   store: new MemoryStore(),
 *   rerankerScorer: async (query, content) => crossEncoder.score(query, content),
 * })
 * ```
 */
export async function createAdvancedRAG(options: AdvancedRAGOptions): Promise<RAGPipeline> {
  const { FixedSizeChunker } = await import('@ragsdk/document');
  const {
    QueryRewriter,
    VectorSearch,
    KeywordSearch,
    FusionSearch,
    ThresholdPostProcessor,
    RerankerPostProcessor,
  } = await import('@ragsdk/retrieval');

  const vectorWeight = options.vectorWeight ?? 0.7;
  const keywordWeight = options.keywordWeight ?? 1 - vectorWeight;

  // 构建混合检索器
  const vectorSearch = new VectorSearch(options.embedding, options.store);
  const keywordSearch = new KeywordSearch();
  const retriever = new FusionSearch(vectorSearch, keywordSearch, vectorWeight, keywordWeight);

  // 构建后处理器链
  const topK = options.topK ?? 10;
  const postProcessors: PostProcessor[] = [
    new ThresholdPostProcessor({
      threshold: options.threshold ?? 0.5,
      maxResults: topK,
    }),
  ];

  if (options.rerankerScorer) {
    postProcessors.push(
      new RerankerPostProcessor(options.rerankerScorer, {
        topK: options.rerankTopK ?? 5,
      }),
    );
  }

  return new RAGPipeline({
    llm: options.llm,
    embedding: options.embedding,
    store: options.store,
    chunker: new FixedSizeChunker({
      chunkSize: options.chunkSize ?? 500,
      overlap: options.overlap ?? 50,
    }),
    queryTransformers: [new QueryRewriter(options.llm)],
    retriever,
    postProcessors,
  });
}
