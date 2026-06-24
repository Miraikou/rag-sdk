/**
 * @rag-sdk/generation 基础用法示例
 *
 * 运行: npx tsx packages/generation/demo/basic.ts
 *
 * 需要设置环境变量 OPENAI_API_KEY
 */

import {
  StandardGenerator,
  GroundedGenerator,
  CitationGenerator,
  SelfRAGGenerator,
  ConsistencyChecker,
  BasePromptTemplate,
} from '../src/index';
import type { Chunk } from '@rag-sdk/core';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  请设置环境变量 OPENAI_API_KEY 以运行完整示例');
    console.log('   export OPENAI_API_KEY=sk-xxxxx\n');
    return;
  }

  // 动态导入避免类型检查时缺少依赖
  const { OpenAIProvider } = await import('@rag-sdk/llm');
  const llm = new OpenAIProvider({ apiKey, defaultModel: 'gpt-4o-mini' });

  const testChunks: Chunk[] = [
    {
      id: 'c1',
      documentId: 'd1',
      content: 'RAG（检索增强生成）是一种结合信息检索与文本生成的技术架构。它首先从知识库中检索相关文档，然后将检索结果作为上下文提供给 LLM 进行生成。',
      metadata: { title: 'RAG 概述', source: '技术文档' },
    },
    {
      id: 'c2',
      documentId: 'd1',
      content: 'RAG 的主要优势包括：减少幻觉、提高事实准确性、支持动态知识更新、降低模型微调成本。',
      metadata: { title: 'RAG 优势', source: '技术文档' },
    },
  ];

  // ==================== 标准生成器 ====================

  console.log('=== 标准生成器 ===\n');

  const standard = new StandardGenerator(llm);
  const standardResult = await standard.generate('什么是 RAG？', testChunks);

  console.log('回答:', standardResult.answer);
  console.log(`来源数: ${standardResult.sources.length}\n`);

  // ==================== 接地生成器 ====================

  console.log('=== 接地生成器（Grounding）===\n');

  const grounded = new GroundedGenerator(llm);
  const groundedResult = await grounded.generate('RAG 有哪些优势？', testChunks);

  console.log('回答:', groundedResult.answer);
  console.log(`接地分数: ${groundedResult.verification.groundingScore.toFixed(2)}`);
  console.log(`是否接地: ${groundedResult.verification.isGrounded ? '✅ 是' : '⚠️ 否'}`);
  console.log(`未支撑声明: ${groundedResult.verification.unsupportedClaims.length} 条\n`);

  // ==================== 引用生成器 ====================

  console.log('=== 引用生成器（Citation）===\n');

  const citation = new CitationGenerator(llm);
  const citationResult = await citation.generate('介绍一下 RAG 技术', testChunks);

  console.log('回答:', citationResult.answer);
  console.log(`引用数: ${citationResult.sources.length}`);
  console.log(`带引用的答案: ${citationResult.citedAnswer.substring(0, 100)}...\n`);

  // ==================== Self-RAG 生成器 ====================

  console.log('=== Self-RAG 生成器 ===\n');

  const selfRAG = new SelfRAGGenerator(llm);
  const selfRAGResult = await selfRAG.generate('什么是 RAG？', testChunks);

  console.log('回答:', selfRAGResult.answer.substring(0, 150) + '...');
  console.log(`轮数: ${selfRAGResult.reflection ? selfRAGResult.rounds : 'N/A'}`);
  console.log(`是否重新生成: ${selfRAGResult.regenerated}\n`);

  // ==================== 一致性检查器 ====================

  console.log('=== 一致性检查器 ===\n');

  // ConsistencyChecker 需要一个 Generator 实例
  const checker = new ConsistencyChecker(standard, { rounds: 2 });
  const consistency = await checker.check(
    'RAG 可以有效减少 LLM 的幻觉问题。',
    testChunks,
  );

  console.log(`一致性分数: ${consistency.consistencyScore.toFixed(2)}`);
  console.log(`最佳答案: ${consistency.bestAnswer.substring(0, 100)}...`);
  console.log(`冲突数: ${consistency.conflicts.length}`);

  // ==================== 自定义 Prompt 模板 ====================

  console.log('\n=== 自定义 Prompt 模板 ===\n');

  const template = new BasePromptTemplate(
    '你是一个{role}。请根据以下参考资料回答用户问题。',
    '参考资料：\n{context}\n\n用户问题：{query}\n\n请用{language}回答。',
  );

  const messages = template.format('什么是 RAG？', testChunks, { includeMetadata: true });

  console.log('格式化后的消息:');
  console.log(`  System: ${messages[0]?.content.substring(0, 60)}...`);
  console.log(`  User: ${messages[1]?.content.substring(0, 100)}...`);
}

main().catch(console.error);
