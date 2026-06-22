import type {
  EmbeddingProvider,
  VectorStore,
  Retriever,
  RetrieveOptions,
  SearchResult,
} from '@rag-sdk/core';

/**
 * 向量语义搜索
 *
 * 将查询文本转为嵌入向量，在向量存储中做近似最近邻检索。
 */
export class VectorSearch implements Retriever {
  /**
   * 创建向量语义搜索实例
   *
   * @param embedding - 嵌入向量生成器，用于将文本转为向量表示
   * @param store - 向量存储后端，用于执行近似最近邻检索
   */
  constructor(
    private embedding: EmbeddingProvider,
    private store: VectorStore,
  ) {}

  /**
   * 执行向量语义检索
   *
   * 将查询文本转为嵌入向量后，在向量存储中搜索最相似的结果。
   *
   * @param query - 查询文本
   * @param options - 检索选项（topK、filter、threshold 等）
   * @returns 按相似度排序的检索结果列表
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    const queryVector = await this.embedding.embed(query);
    return this.store.search(queryVector, {
      topK: options?.topK ?? 5,
      filter: options?.filter,
      threshold: options?.threshold,
    });
  }
}
