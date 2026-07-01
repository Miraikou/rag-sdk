import type { PipelineConfig } from '@ragsdk/core';
import { RAGPipeline } from '@ragsdk/core';

/**
 * Simple RAG — 最基础的 RAG 配置
 *
 * 固定大小切块 + 向量检索 + 基础生成
 * 适合快速上手和简单场景
 *
 * @example
 * ```ts
 * import { simpleRAG } from 'rag-sdk/pipeline';
 * import { OpenAIProvider } from '@ragsdk/llm';
 * import { OpenAIEmbedding } from '@ragsdk/embedding';
 * import { MemoryStore } from '@ragsdk/storage';
 *
 * const rag = simpleRAG({
 *   llm: new OpenAIProvider({ apiKey: '...' }),
 *   embedding: new OpenAIEmbedding({ apiKey: '...' }),
 *   store: new MemoryStore(),
 * });
 * ```
 */
export interface SimpleRAGOptions {
  llm: PipelineConfig['llm'];
  embedding: PipelineConfig['embedding'];
  store: PipelineConfig['store'];
  chunkSize?: number;
  overlap?: number;
  topK?: number;
}

export async function createSimpleRAG(options: SimpleRAGOptions): Promise<RAGPipeline> {
  // 动态导入避免循环依赖
  const { FixedSizeChunker } = await import('@ragsdk/document');

  // 构建带 topK 的默认检索器
  const topK = options.topK;
  const retriever =
    topK !== undefined
      ? {
          async retrieve(
            query: string,
            opts?: { topK?: number; filter?: Record<string, unknown> },
          ) {
            const queryVector = await options.embedding.embed(query);
            return options.store.search(queryVector, {
              topK: opts?.topK ?? topK,
              filter: opts?.filter,
            });
          },
        }
      : undefined;

  const pipeline = new RAGPipeline({
    llm: options.llm,
    embedding: options.embedding,
    store: options.store,
    chunker: new FixedSizeChunker({
      chunkSize: options.chunkSize ?? 500,
      overlap: options.overlap ?? 50,
    }),
    retriever,
    // Simple RAG 不使用查询变换、后处理
  });

  return pipeline;
}
