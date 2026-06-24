// 类型
export type {
  RetrievalSample,
  GenerationSample,
  MetricStats,
  BenchmarkReport,
  E2EJudgeResult,
  ABTestEvent,
  ABTestReport,
  FullReport,
} from './types';

// Re-export 核心评测接口
export type { MetricResult, RetrievalEvaluator, GenerationEvaluator } from '@rag-sdk/core';

// 检索指标
export { RecallEvaluator } from './retrieval/recall';
export { PrecisionEvaluator } from './retrieval/precision';
export { MRREvaluator } from './retrieval/mrr';
export { NDCGEvaluator } from './retrieval/ndcg';
export { ContextRelevanceEvaluator } from './retrieval/context-relevance';
export type { ContextRelevanceOptions } from './retrieval/context-relevance';

// 生成指标
export { BLEUEvaluator } from './generation/bleu';
export { ROUGEEvaluator } from './generation/rouge';
export { BERTScoreEvaluator } from './generation/bert-score';
export { FaithfulnessEvaluator } from './generation/faithfulness';
export { AnswerRelevanceEvaluator } from './generation/relevance';
export type { AnswerRelevanceOptions } from './generation/relevance';

// E2E 评测
export { E2ELLMJudge } from './e2e/llm-judge';
export type { E2ELLMJudgeOptions } from './e2e/llm-judge';
export { ABTestAnalyzer } from './e2e/ab-test';

// 运行器 & 报告
export { BenchmarkRunner } from './benchmark';
export { EvaluationReport } from './report';
