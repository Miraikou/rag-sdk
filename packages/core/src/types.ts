// ==================== 全局基础类型 ====================

/** 原始文档 */
export interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

/** 文本块（检索与生成的核心单元） */
export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  parentId?: string;
  children?: string[];
  contextHeader?: string;
}

/** 检索来源通道 */
export type SearchSource = 'vector' | 'keyword' | 'graph' | 'fusion';

/** 检索结果 */
export interface SearchResult {
  chunk: Chunk;
  score: number;
  source: SearchSource;
}

/** 引用信息 */
export interface Citation {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
}

/** 生成结果 */
export interface GenerateResult {
  answer: string;
  sources: Citation[];
  metadata: Record<string, unknown>;
}

/** 消息角色 */
export type MessageRole = 'system' | 'user' | 'assistant';

/** LLM 对话消息 */
export interface Message {
  role: MessageRole;
  content: string;
}

// ==================== Chat / LLM ====================

/** LLM 调用选项 */
export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
}

/** LLM 提供商接口 */
export interface LLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<string>;
}

// ==================== Embedding ====================

/** 向量嵌入提供商接口 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
}

// ==================== Storage ====================

/** 向量搜索选项 */
export interface SearchOptions {
  topK?: number;
  filter?: Record<string, unknown>;
  threshold?: number;
}

/** 向量存储接口 */
export interface VectorStore {
  upsert(chunks: Chunk[]): Promise<void>;
  upsertByDocument(documentId: string, chunks: Chunk[]): Promise<void>;
  search(query: number[], options?: SearchOptions): Promise<SearchResult[]>;
  delete(ids: string[]): Promise<void>;
  deleteByDocument(documentId: string): Promise<void>;
}

// ==================== Chunking ====================

/** 切块选项 */
export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
  separator?: string;
}

/** 切块策略接口 */
export interface Chunker {
  chunk(document: Document, options?: ChunkOptions): Chunk[];
}

// ==================== Document Loader ====================

/** 文档加载器接口 */
export interface DocumentLoader {
  load(source: string | Buffer): Promise<Document[]>;
}

// ==================== Retrieval ====================

/** 查询变换接口 */
export interface QueryTransformer {
  transform(query: string): Promise<string | string[]>;
}

/** 检索选项 */
export interface RetrieveOptions {
  topK?: number;
  filter?: Record<string, unknown>;
}

/** 检索器接口 */
export interface Retriever {
  retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]>;
}

/** 后处理器接口 */
export interface PostProcessor {
  process(results: SearchResult[], query: string): Promise<SearchResult[]>;
}

// ==================== Generation ====================

/** 生成选项 */
export interface GenerateOptions {
  promptTemplate?: string;
  maxTokens?: number;
  includeSources?: boolean;
}

/** 答案生成器接口 */
export interface Generator {
  generate(
    query: string,
    chunks: Chunk[],
    options?: GenerateOptions,
  ): Promise<GenerateResult>;
}

// ==================== Pipeline ====================

/** Pipeline 配置 */
export interface PipelineConfig {
  llm: LLMProvider;
  embedding: EmbeddingProvider;
  store: VectorStore;
  chunker: Chunker;
  queryTransformers?: QueryTransformer[];
  retriever?: Retriever;
  postProcessors?: PostProcessor[];
  generator?: Generator;
}

/** Pipeline 接口 */
export interface Pipeline {
  ingest(documents: Document[]): Promise<void>;
  query(question: string): Promise<GenerateResult>;
  queryStream(question: string): AsyncIterable<string>;
}

// ==================== Evaluation ====================

/** 指标结果 */
export interface MetricResult {
  name: string;
  score: number;
  details?: Record<string, unknown>;
}

/** 检索评估器接口 */
export interface RetrievalEvaluator {
  evaluate(results: SearchResult[], groundTruthIds: string[]): MetricResult;
}

/** 生成评估器接口 */
export interface GenerationEvaluator {
  evaluate(answer: string, reference: string, context?: string): MetricResult;
}
