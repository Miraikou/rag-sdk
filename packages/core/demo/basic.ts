/**
 * @ragsdk/core 基础用法示例
 *
 * 运行: npx tsx packages/core/demo/basic.ts
 */

import {
  RAGPipeline,
  RetrievalRouter,
  LoggingMonitor,
  CharBasedTokenCounter,
  DefaultTokenBudgetManager,
  Logger,
} from '../src/index';
import type { RouteRule, Retriever } from '../src/index';

// ==================== Logger 示例 ====================

console.log('=== Logger 示例 ===\n');

const logger = new Logger('demo');
logger.info('Logger 初始化完成');
logger.debug('这条不会显示（默认 level=info）');
logger.warn('这是一条警告');

// ==================== Token 计数器示例 ====================

console.log('\n=== Token 计数器示例 ===\n');

const counter = new CharBasedTokenCounter();
const sampleText = 'Hello, RAG SDK! 这是一个测试文本。';
const tokens = counter.count(sampleText);
console.log(`文本: "${sampleText}"`);
console.log(`估算 Token 数: ${tokens}`);

// ==================== Token 预算管理器示例 ====================

console.log('\n=== Token 预算管理器示例 ===\n');

const budget = new DefaultTokenBudgetManager({
  maxTokens: 4096,
  systemReserved: 0,
  generationReserved: 1024,
});
console.log(`总预算: 4096, 生成预留: 1024`);
console.log(`可用上下文预算: ${budget.getAvailableForContext()}`);

const chunks = [
  { id: '1', documentId: 'doc-1', content: '短文本', metadata: {} },
  { id: '2', documentId: 'doc-1', content: 'A'.repeat(5000), metadata: {} },
];
const truncated = budget.truncateContext(chunks);
console.log(`截断后 chunk 数: ${truncated.length}`);

// ==================== Monitor 示例 ====================

console.log('\n=== Monitor 示例 ===\n');

const monitor = new LoggingMonitor();
monitor.onStageStart('retrieve');
monitor.onStageEnd('retrieve', { stage: 'retrieve', durationMs: 45, resultCount: 5 });
monitor.onQueryComplete({
  queryDurationMs: 150,
  stages: [
    { stage: 'transform', durationMs: 200, tokenCount: 50 },
    { stage: 'retrieve', durationMs: 45, resultCount: 5 },
    { stage: 'generate', durationMs: 800, tokenCount: 150 },
  ],
  totalTokens: 200,
});

// ==================== Router 示例 ====================

console.log('\n=== Router 示例 ===\n');

// 创建 mock retriever
const mockRetriever: Retriever = {
  retrieve: async (_query: string) => [],
};

// RouteRule 使用 match 函数而非 pattern 正则
const rules: RouteRule[] = [
  {
    name: 'short-query',
    match: (query: string) => query.length <= 20,
    retriever: mockRetriever,
  },
  {
    name: 'keyword-rich',
    match: (query: string) => /\b(error|bug|fix|issue)\b/i.test(query),
    retriever: mockRetriever,
  },
];

const router = new RetrievalRouter(mockRetriever, rules);

const queries = [
  '什么是 RAG？',
  '如何修复 error: connection refused',
  '请详细解释向量检索和关键词检索的区别以及各自的优缺点',
];

for (const q of queries) {
  const decision = await router.route(q);
  console.log(`查询: "${q}"`);
  console.log(`  匹配规则: ${decision.type}\n`);
}

// ==================== Pipeline 架构说明 ====================

console.log('=== RAGPipeline 架构 ===\n');
console.log('RAGPipeline 是核心编排器，协调以下阶段：');
console.log('  1. ingest: chunk → embed → store');
console.log('  2. query: transform → retrieve → post-process → generate');
console.log('');
console.log('配置需要: llm + embedding + store + chunker');
console.log('可选: queryTransformers, retriever, postProcessors, generator, monitor, tokenBudget');
console.log('');
console.log('完整示例请参考 rag-sdk 包的 demo');
