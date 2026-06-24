/**
 * @rag-sdk/evaluation 基础用法示例
 *
 * 运行: npx tsx packages/evaluation/demo/basic.ts
 *
 * 需要设置环境变量 OPENAI_API_KEY 以运行 LLM 相关评测
 */

import {
  RecallEvaluator,
  PrecisionEvaluator,
  MRREvaluator,
  NDCGEvaluator,
  BLEUEvaluator,
  ROUGEEvaluator,
  FaithfulnessEvaluator,
  AnswerRelevanceEvaluator,
  BenchmarkRunner,
  EvaluationReport,
} from '../src/index';
import type { SearchResult, Retriever } from '@rag-sdk/core';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  // ==================== 检索指标 ====================

  console.log('=== 检索指标 ===\n');

  const searchResults: SearchResult[] = [
    { chunk: { id: 'c1', documentId: 'd1', content: 'RAG 概述', metadata: {} }, score: 0.95, source: 'vector' },
    { chunk: { id: 'c2', documentId: 'd1', content: 'RAG 优势', metadata: {} }, score: 0.85, source: 'vector' },
    { chunk: { id: 'c3', documentId: 'd2', content: '向量数据库', metadata: {} }, score: 0.70, source: 'vector' },
    { chunk: { id: 'c4', documentId: 'd3', content: 'Python 编程', metadata: {} }, score: 0.60, source: 'vector' },
  ];

  const groundTruthIds = ['c1', 'c2', 'c3'];

  const recall = new RecallEvaluator();
  const recallResult = recall.evaluate(searchResults, groundTruthIds);
  console.log(`Recall@${searchResults.length}: ${recallResult.score.toFixed(4)}`);

  const precision = new PrecisionEvaluator();
  const precisionResult = precision.evaluate(searchResults, groundTruthIds);
  console.log(`Precision@${searchResults.length}: ${precisionResult.score.toFixed(4)}`);

  const mrr = new MRREvaluator();
  const mrrResult = mrr.evaluate(searchResults, groundTruthIds);
  console.log(`MRR: ${mrrResult.score.toFixed(4)}`);

  const ndcg = new NDCGEvaluator();
  const ndcgResult = ndcg.evaluate(searchResults, groundTruthIds);
  console.log(`NDCG: ${ndcgResult.score.toFixed(4)}`);

  // ==================== 生成指标 ====================

  console.log('\n=== 生成指标 ===\n');

  const reference = 'RAG 是一种结合检索和生成的技术架构。';
  const candidate = 'RAG 是将检索与生成相结合的 AI 技术。';

  const bleu = new BLEUEvaluator();
  const bleuResult = bleu.evaluate(candidate, reference);
  console.log(`BLEU: ${bleuResult.score.toFixed(4)}`);

  const rouge = new ROUGEEvaluator();
  const rougeResult = rouge.evaluate(candidate, reference);
  console.log(`ROUGE-L: ${rougeResult.score.toFixed(4)}`);

  if (apiKey) {
    console.log('\n=== LLM 评测 ===\n');

    // 动态导入避免类型检查时缺少构建产物
    const { OpenAIProvider } = await import('@rag-sdk/llm');
    const llm = new OpenAIProvider({ apiKey, defaultModel: 'gpt-4o-mini' });

    const faithfulness = new FaithfulnessEvaluator(llm);
    const faithResult = await faithfulness.evaluate(
      'RAG 可以减少 LLM 幻觉问题，提高事实准确性。',
      'RAG 通过检索外部知识库来增强 LLM 的生成能力。',
      'RAG 是一种结合检索与生成的技术。',
    );
    console.log(`忠实度: ${faithResult.score.toFixed(4)}`);

    const relevance = new AnswerRelevanceEvaluator(llm);
    const relResult = await relevance.evaluate(
      'RAG 可以有效提升生成质量。',
      'RAG 结合检索和生成，减少幻觉并提高准确性。',
    );
    console.log(`答案相关性: ${relResult.score.toFixed(4)}`);
  } else {
    console.log('⚠️  设置 OPENAI_API_KEY 可运行 LLM 评测（忠实度、答案相关性等）\n');
  }

  // ==================== Benchmark 运行器 ====================

  console.log('\n=== Benchmark 运行器 ===\n');

  const mockRetriever: Retriever = {
    retrieve: async () => searchResults,
  };

  const runner = new BenchmarkRunner({ concurrency: 3 });
  const benchmarkReport = await runner.runRetrievalBenchmark(
    [recall, precision, mrr],
    mockRetriever,
    [
      { query: 'RAG 是什么', relevantIds: ['c1', 'c2'] },
      { query: '向量数据库', relevantIds: ['c3'] },
    ],
  );

  console.log('Benchmark 报告:');
  console.log(`  样本数: ${benchmarkReport.totalSamples}`);
  console.log(`  评测器: ${benchmarkReport.evaluators.join(', ')}`);
  for (const [name, stats] of Object.entries(benchmarkReport.metrics)) {
    console.log(`  - ${name}: mean=${stats.mean.toFixed(4)}, std=${stats.std.toFixed(4)}`);
  }

  // ==================== 评测报告 ====================

  console.log('\n=== 评测报告 ===\n');

  const evalReport = new EvaluationReport();
  evalReport.setRetrievalReport(benchmarkReport);
  const fullReport = evalReport.generateReport();
  console.log('汇总报告:');
  console.log(`  综合评分: ${fullReport.summary.overallScore.toFixed(2)}`);
  console.log(`  评定: ${fullReport.summary.verdict}`);
  console.log(`  建议: ${fullReport.recommendations.join('; ')}`);
}

main().catch(console.error);
