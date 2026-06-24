/**
 * rag-sdk 完整 Pipeline 用法示例
 *
 * 运行: npx tsx packages/rag-sdk/demo/basic.ts
 *
 * 需要设置环境变量 OPENAI_API_KEY
 */

import {
  RAGPipeline,
  MemoryStore,
  OpenAIEmbeddingProvider,
  OpenAIProvider,
  FixedSizeChunker,
  createSimpleRAG,
  createAdvancedRAG,
  PipelineBuilder,
} from '../src/index';
import type { Document } from '@rag-sdk/core';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  请设置环境变量 OPENAI_API_KEY 以运行完整示例');
    console.log('   export OPENAI_API_KEY=sk-xxxxx\n');
    return;
  }

  const llm = new OpenAIProvider({ apiKey, defaultModel: 'gpt-4o-mini' });
  const embedding = new OpenAIEmbeddingProvider({ apiKey, model: 'text-embedding-3-small' });
  const store = new MemoryStore();

  const docs: Document[] = [
    {
      id: 'doc-1',
      content: 'RAG（Retrieval-Augmented Generation）是一种结合了信息检索和文本生成的 AI 技术。它通过从外部知识库中检索相关信息来增强 LLM 的生成能力。',
      metadata: { source: 'wiki' },
    },
    {
      id: 'doc-2',
      content: 'RAG 的主要优势包括：减少幻觉（hallucination）、提高事实准确性、支持动态知识更新、降低模型微调成本。',
      metadata: { source: 'paper' },
    },
    {
      id: 'doc-3',
      content: '向量数据库是 RAG 系统的核心组件之一。常见的向量数据库有 Pinecone、Weaviate、Chroma、Qdrant 等。',
      metadata: { source: 'blog' },
    },
  ];

  // ==================== 方式 1: 使用预设 createSimpleRAG ====================

  console.log('=== 方式 1: createSimpleRAG（预设） ===\n');

  const simpleRAG = await createSimpleRAG({
    llm,
    embedding,
    store,
    chunkSize: 200,
    overlap: 50,
    topK: 3,
  });

  // 摄入文档
  console.log('摄入文档...');
  await simpleRAG.ingest(docs);
  console.log(`已摄入 ${docs.length} 个文档\n`);

  // 查询
  console.log('查询: "什么是 RAG？"\n');
  const result = await simpleRAG.query('什么是 RAG？');

  console.log('回答:', result.answer);
  console.log(`\n来源 (${result.sources.length}):`);
  result.sources.forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.content.substring(0, 80)}...`);
  });
  console.log();

  // ==================== 方式 2: 使用 createAdvancedRAG ====================

  console.log('=== 方式 2: createAdvancedRAG（预设） ===\n');

  const advancedRAG = await createAdvancedRAG({
    llm,
    embedding,
    store,
    threshold: 0.5,
    topK: 10,
  });

  await advancedRAG.ingest(docs);

  console.log('查询: "RAG 相比传统 LLM 有什么优势？"\n');
  const advResult = await advancedRAG.query('RAG 相比传统 LLM 有什么优势？');

  console.log('回答:', advResult.answer);
  console.log(`来源: ${advResult.sources.length} 条\n`);

  // ==================== 方式 3: 使用 PipelineBuilder 自定义 ====================

  console.log('=== 方式 3: PipelineBuilder（自定义） ===\n');

  const customRAG = new PipelineBuilder()
    .setLLM(llm)
    .setEmbedding(embedding)
    .setStore(store)
    .setChunker(new FixedSizeChunker({ chunkSize: 200, overlap: 50 }))
    .build();

  await customRAG.ingest(docs);

  console.log('查询: "向量数据库在 RAG 中的作用是什么？"\n');
  const customResult = await customRAG.query('向量数据库在 RAG 中的作用是什么？');

  console.log('回答:', customResult.answer);
  console.log(`来源: ${customResult.sources.length} 条`);
}

main().catch(console.error);
