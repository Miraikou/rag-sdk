// Re-export 核心评测类型
export type { MetricResult, RetrievalEvaluator, GenerationEvaluator } from '@rag-sdk/core';

// ==================== 检索评测 ====================

/** 检索评测数据集条目 */
export interface RetrievalSample {
  /** 查询文本 */
  query: string;
  /** 相关文档 ID 列表（ground truth） */
  relevantIds: string[];
  /** 可选的分级相关性分数（用于 NDCG） */
  relevanceScores?: Map<string, number>;
}

// ==================== 生成评测 ====================

/** 生成评测数据集条目 */
export interface GenerationSample {
  /** 原始查询 */
  query: string;
  /** 系统生成的回答 */
  answer: string;
  /** 参考回答（ground truth） */
  reference: string;
  /** 检索到的上下文（可选，用于 faithfulness 等指标） */
  contexts?: string[];
}

// ==================== 评测报告 ====================

/** 单个指标的统计汇总 */
export interface MetricStats {
  /** 平均值 */
  mean: number;
  /** 标准差 */
  std: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
}

/** 评测报告 */
export interface BenchmarkReport {
  /** 各指标的统计汇总 */
  metrics: Record<string, MetricStats>;
  /** 每个样本的各指标得分 */
  perSample: Array<Record<string, number>>;
  /** 总样本数 */
  totalSamples: number;
  /** 使用的评测指标名称列表 */
  evaluators: string[];
  /** 评测时间戳 */
  timestamp: string;
}

// ==================== E2E LLM Judge ====================

/** 端到端 LLM 裁判结果 */
export interface E2EJudgeResult {
  /** 各维度评分（1-10） */
  scores: Record<string, number>;
  /** 综合评分（1-10） */
  overallScore: number;
  /** 综合评语 */
  feedback: string;
  /** 各维度的评分理由 */
  dimensionReasons: Record<string, string>;
}

// ==================== A/B Test ====================

/** A/B 测试事件 */
export interface ABTestEvent {
  /** 分组标识（A 或 B） */
  group: 'A' | 'B';
  /** 用户反馈：点赞 */
  thumbsUp?: boolean;
  /** 用户反馈：追问 */
  followUp?: boolean;
  /** 用户行为：点击来源链接 */
  sourceClick?: boolean;
  /** 停留时间（秒） */
  dwellTime?: number;
}

/** A/B 测试报告 */
export interface ABTestReport {
  /** A 组满意度均值 */
  satisfactionA: number;
  /** B 组满意度均值 */
  satisfactionB: number;
  /** A 组样本数 */
  countA: number;
  /** B 组样本数 */
  countB: number;
  /** Z-test 统计量 */
  zScore: number;
  /** p-value */
  pValue: number;
  /** 是否有统计显著性差异 */
  significant: boolean;
  /** 胜出分组 */
  winner: 'A' | 'B' | 'tie';
}

// ==================== 完整评测报告 ====================

/** 完整评测报告 */
export interface FullReport {
  /** 时间戳 */
  timestamp: string;
  /** 摘要 */
  summary: {
    totalSamples: number;
    overallScore: number;
    verdict: string;
  };
  /** 检索评测结果 */
  retrieval?: BenchmarkReport;
  /** 生成评测结果 */
  generation?: BenchmarkReport;
  /** E2E 评测结果 */
  e2e?: {
    llmJudgeScores?: Record<string, number>;
    abTest?: ABTestReport;
  };
  /** 改进建议 */
  recommendations: string[];
}
