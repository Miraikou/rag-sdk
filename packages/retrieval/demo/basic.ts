/**
 * @rag-sdk/retrieval 基础用法示例
 *
 * 运行: npx tsx packages/retrieval/demo/basic.ts
 *
 * 需要设置环境变量 OPENAI_API_KEY 以运行 LLM 相关功能
 */

import {
  VectorSearch,
  KeywordSearch,
  FusionSearch,
  RRFSearch,
  QueryRewriter,
  MultiQueryExpander,
  HyDETransformer,
  ThresholdPostProcessor,
  RerankerPostProcessor,
} from '../src/index';
import { MemoryStore } from '@rag-sdk/storage';
import { OpenAIEmbeddingProvider } from '@rag-sdk/embedding';
import type { Chunk, SearchResult, EmbeddingProvider } from '@rag-sdk/core';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  // ==================== 准备数据 ====================

  console.log('=== 准备测试数据 ===\n');

  const store = new MemoryStore();

  const chunks: Chunk[] = [
    { id: 'c1', documentId: 'd1', content: 'Python 是一门流行的编程语言。', metadata: { lang: 'python' }, embedding: [1, 0, 0] },
    { id: 'c2', documentId: 'd1', content: 'Python 广泛用于数据科学和 AI 开发。', metadata: { lang: 'python' }, embedding: [0.9, 0.1, 0] },
    { id: 'c3', documentId: 'd2', content: 'TypeScript 是 JavaScript 的超集。', metadata: { lang: 'typescript' }, embedding: [0, 1, 0] },
    { id: 'c4', documentId: 'd2', content: 'TypeScript 提供静态类型检查。', metadata: { lang: 'typescript' }, embedding: [0, 0.9, 0.1] },
    { id: 'c5', documentId: 'd3', content: 'Rust 是一门系统编程语言，注重内存安全。', metadata: { lang: 'rust' }, embedding: [0, 0, 1] },
  ];

  await store.upsert(chunks);
  console.log(`已存储 ${chunks.length} 个 chunks\n`);

  // Mock embedding provider（不需要真实 API key 即可演示搜索）
  const mockEmbedding: EmbeddingProvider = {
    dimension: 3,
    embed: async () => [1, 0, 0],
    embedBatch: async () => [[1, 0, 0]],
  };

  // ==================== 搜索策略 ====================

  console.log('=== 向量搜索 ===\n');
  const vectorSearch = new VectorSearch(mockEmbedding, store);
  const vecResults = await vectorSearch.retrieve('Python 编程', { topK: 3 });
  printResults('向量搜索', vecResults);

  console.log('=== 关键词搜索 ===\n');
  const keywordSearch = new KeywordSearch(chunks);
  const kwResults = await keywordSearch.retrieve('Python 编程');
  printResults('关键词搜索', kwResults);

  console.log('=== 融合搜索 (Fusion) ===\n');
  const fusionSearch = new FusionSearch(vectorSearch, keywordSearch, 0.5, 0.5);
  const fusionResults = await fusionSearch.retrieve('Python 编程', { topK: 3 });
  printResults('融合搜索', fusionResults);

  console.log('=== RRF 搜索 ===\n');
  const rrfSearch = new RRFSearch(60);
  const rrfResults = rrfSearch.fuse([vecResults, kwResults], 3);
  printResults('RRF 搜索', rrfResults);

  // ==================== 后处理 ====================

  console.log('=== 后处理：阈值过滤 ===\n');
  const threshold = new ThresholdPostProcessor({ threshold: 0.9 });
  const allResults = await vectorSearch.retrieve('Python', { topK: 10 });
  const filtered = await threshold.process(allResults, 'Python');
  console.log(`阈值过滤前: ${allResults.length} 条 → 过滤后: ${filtered.length} 条\n`);

  if (apiKey) {
    // ==================== 查询变换 ====================

    console.log('=== 查询变换：Query Rewriter ===\n');
    const { OpenAIProvider } = await import('@rag-sdk/llm');
    const llm = new OpenAIProvider({ apiKey, defaultModel: 'gpt-4o-mini' });
    const rewriter = new QueryRewriter(llm);
    const rewritten = await rewriter.transform('怎么用那个AI东西做搜索？');
    console.log(`原始查询: "怎么用那个AI东西做搜索？"`);
    console.log(`改写后: "${rewritten}"\n`);

    console.log('=== 查询变换：MultiQuery ===\n');
    const multiQuery = new MultiQueryExpander(llm);
    const expanded = await multiQuery.transform('RAG 检索优化');
    console.log(`原始查询: "RAG 检索优化"`);
    console.log(`生成 ${Array.isArray(expanded) ? expanded.length : 1} 个子查询:`);
    if (Array.isArray(expanded)) {
      expanded.forEach((q, i) => console.log(`  ${i + 1}. "${q}"`));
    }
    console.log();

    // ==================== 后处理：Reranker ===\n
    console.log('=== 后处理：Reranker ===\n');
    // RerankerPostProcessor 接受一个 scorer 函数
    const scorer = async (query: string, content: string): Promise<number> => {
      const response = await llm.chat([
        { role: 'system', content: '评估查询与内容的相关性（0-1），只回复数字。' },
        { role: 'user', content: `查询: ${query}\n内容: ${content}` },
      ]);
      return parseFloat(response.trim()) || 0;
    };
    const reranker = new RerankerPostProcessor(scorer, { topK: 2 });
    const reranked = await reranker.process(allResults.slice(0, 3), 'Python 编程语言');
    console.log(`Rerank 后保留 ${reranked.length} 条结果\n`);
  } else {
    console.log('⚠️  设置 OPENAI_API_KEY 可运行 LLM 相关功能（Query Rewriter、HyDE、Reranker 等）\n');
  }
}

function printResults(name: string, results: SearchResult[]): void {
  console.log(`${name} 结果:`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.chunk.id}] score=${r.score.toFixed(4)} "${r.chunk.content}"`);
  });
  console.log();
}

main().catch(console.error);
