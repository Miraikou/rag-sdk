/**
 * @rag-sdk/storage 基础用法示例
 *
 * 运行: npx tsx packages/storage/demo/basic.ts
 */

import { MemoryStore, IndexManager } from '../src/index';
import type { Chunk } from '@rag-sdk/core';

// ==================== MemoryStore 示例 ====================

console.log('=== MemoryStore 向量存储 ===\n');

const store = new MemoryStore();

// 创建测试 chunks
const chunks: Chunk[] = [
  {
    id: 'chunk-1',
    documentId: 'doc-1',
    content: 'RAG 结合了检索和生成两种技术。',
    metadata: { topic: 'AI', category: 'overview' },
    embedding: [1.0, 0.0, 0.0],
  },
  {
    id: 'chunk-2',
    documentId: 'doc-1',
    content: '向量数据库用于存储和检索高维向量。',
    metadata: { topic: 'AI', category: 'database' },
    embedding: [0.0, 1.0, 0.0],
  },
  {
    id: 'chunk-3',
    documentId: 'doc-2',
    content: 'Embedding 模型将文本转换为向量表示。',
    metadata: { topic: 'AI', category: 'embedding' },
    embedding: [0.0, 0.0, 1.0],
  },
];

// 存储 chunks
await store.upsert(chunks);
console.log(`已存储 ${chunks.length} 个 chunks\n`);

// 搜索最相似的 chunk
const results = await store.search([1.0, 0.0, 0.0], { topK: 2 });
console.log('查询向量: [1.0, 0.0, 0.0]');
console.log('搜索结果:');
results.forEach((r, i) => {
  console.log(`  ${i + 1}. [${r.chunk.id}] score=${r.score.toFixed(4)} content="${r.chunk.content}"`);
});

// 带阈值过滤
console.log('\n带阈值过滤 (threshold=0.9):');
const filtered = await store.search([0.5, 0.5, 0.0], { threshold: 0.9 });
console.log(`  结果数: ${filtered.length}`);

// 按 metadata 过滤
console.log('\n按 metadata 过滤 (category=overview):');
const metaFiltered = await store.search([1.0, 0.0, 0.0], { filter: { category: 'overview' } });
metaFiltered.forEach((r) => {
  console.log(`  [${r.chunk.id}] ${r.chunk.content}`);
});

// 删除操作
console.log('\n=== 删除操作 ===\n');
await store.delete(['chunk-1']);
const afterDelete = await store.search([1.0, 0.0, 0.0]);
console.log(`删除 chunk-1 后搜索结果: ${afterDelete.length} 条`);

await store.deleteByDocument('doc-2');
const afterDocDelete = await store.search([0.0, 0.0, 1.0]);
console.log(`删除 doc-2 后搜索结果: ${afterDocDelete.length} 条`);

// ==================== IndexManager 示例 ====================

console.log('\n=== IndexManager 索引管理 ===\n');

const indexManager = new IndexManager(
  new MemoryStore(),
  {
    chunk: (doc) => [{
      id: `${doc.id}-chunk-0`,
      documentId: doc.id,
      content: doc.content,
      metadata: { ...doc.metadata },
    }],
  },
  {
    dimension: 3,
    embed: async () => Array.from({ length: 3 }, () => Math.random()),
    embedBatch: async (texts: string[]) => texts.map(() => Array.from({ length: 3 }, () => Math.random())),
  },
);

const report = await indexManager.sync([
  { id: 'doc-1', content: '文档内容 1', metadata: {} },
  { id: 'doc-2', content: '文档内容 2（更新）', metadata: {} },
]);

console.log('同步报告:');
console.log(`  新增: ${report.added}`);
console.log(`  更新: ${report.updated}`);
console.log(`  删除: ${report.deleted}`);
console.log(`  未变: ${report.unchanged}`);
