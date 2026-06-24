/**
 * @rag-sdk/indexing 基础用法示例
 *
 * 运行: npx tsx packages/indexing/demo/basic.ts
 */

import { IndexingPipeline } from '../src/index';
import { MemoryStore } from '@rag-sdk/storage';
import { FixedSizeChunker } from '@rag-sdk/document';
import type { Document } from '@rag-sdk/core';

// ==================== 模拟 Embedding Provider ====================

const mockEmbedding = {
  dimension: 3,
  embed: async (text: string): Promise<number[]> => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) % 1000;
    }
    return [hash / 1000, (hash * 7) % 1000 / 1000, (hash * 13) % 1000 / 1000];
  },
  embedBatch: async (texts: string[]): Promise<number[][]> => {
    const results: number[][] = [];
    for (const text of texts) {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) % 1000;
      }
      results.push([hash / 1000, (hash * 7) % 1000 / 1000, (hash * 13) % 1000 / 1000]);
    }
    return results;
  },
};

// ==================== 创建 IndexingPipeline ====================

console.log('=== IndexingPipeline 索引流水线 ===\n');

const pipeline = new IndexingPipeline({
  store: new MemoryStore(),
  embedding: mockEmbedding,
  chunker: new FixedSizeChunker({ chunkSize: 100, overlap: 20 }),
});

// ==================== 准备文档 ====================

const documents: Document[] = [
  {
    id: 'doc-1',
    content: `RAG（检索增强生成）是一种结合信息检索与文本生成的技术架构。
它首先从知识库中检索相关文档，然后将检索结果作为上下文提供给 LLM 进行生成。
RAG 的主要优势包括：减少幻觉、提高事实准确性、支持动态知识更新。`,
    metadata: { title: 'RAG 概述', category: 'AI' },
  },
  {
    id: 'doc-2',
    content: `向量数据库是专门用于存储和检索高维向量的数据库系统。
常见的向量数据库包括 Pinecone、Weaviate、Chroma 和 Qdrant。
它们通过近似最近邻（ANN）算法实现高效的相似度搜索。`,
    metadata: { title: '向量数据库', category: 'database' },
  },
];

// ==================== 执行索引 ====================

console.log('输入文档:');
documents.forEach((doc) => {
  console.log(`  - ${doc.id}: "${doc.content.substring(0, 50)}..."`);
});

console.log('\n开始索引...\n');

const report = await pipeline.index(documents);

console.log('索引报告:');
console.log(`  文档加载数: ${report.documentsLoaded}`);
console.log(`  去重后文档数: ${report.documentsAfterDedup}`);
console.log(`  Chunk 创建数: ${report.chunksCreated}`);
console.log(`  Chunk 嵌入数: ${report.chunksEmbedded}`);
console.log(`  Chunk 存储数: ${report.chunksStored}`);
console.log(`  耗时: ${report.duration}ms`);

// ==================== 增量更新 ====================

console.log('\n=== 增量更新 ===\n');

const updatedDocs = [
  {
    id: 'doc-1',
    content: 'RAG 技术已更新：它结合了检索、生成和知识图谱三种技术。',
    metadata: { title: 'RAG 概述 v2', category: 'AI' },
  },
];

const updateReport = await pipeline.index(updatedDocs);
console.log('更新报告:');
console.log(`  文档加载数: ${updateReport.documentsLoaded}`);
console.log(`  Chunk 创建数: ${updateReport.chunksCreated}`);
console.log(`  耗时: ${updateReport.duration}ms`);
