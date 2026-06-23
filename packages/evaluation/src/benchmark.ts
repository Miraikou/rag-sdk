import type { Retriever, SearchResult } from '@rag-sdk/core';
import type {
  BenchmarkReport,
  GenerationSample,
  MetricStats,
  RetrievalSample,
} from './types';

/**
 * 评测运行器
 *
 * 对检索和生成指标执行批量评测，汇总统计结果。
 * 支持并发控制以避免 LLM API 过载。
 */
export class BenchmarkRunner {
  private readonly concurrency: number;

  /**
   * @param options - 运行器配置
   * @param options.concurrency - 并发数，默认 5
   */
  constructor(options?: { concurrency?: number }) {
    this.concurrency = options?.concurrency ?? 5;
  }

  /**
   * 运行检索评测
   *
   * 对每个样本调用检索器，然后用各指标评估结果。
   *
   * @param evaluators - 检索评测器列表
   * @param retriever - 待评测的检索器
   * @param dataset - 检索评测数据集
   * @returns 评测报告
   */
  async runRetrievalBenchmark(
    evaluators: import('@rag-sdk/core').RetrievalEvaluator[],
    retriever: Retriever,
    dataset: RetrievalSample[],
  ): Promise<BenchmarkReport> {
    const perSample: Array<Record<string, number>> = [];

    // 分批并发处理
    for (let i = 0; i < dataset.length; i += this.concurrency) {
      const batch = dataset.slice(i, i + this.concurrency);
      const batchResults = await Promise.all(
        batch.map((sample) => retriever.retrieve(sample.query)),
      );

      for (let j = 0; j < batch.length; j++) {
        const sample = batch[j]!;
        const results = batchResults[j]!;
        const sampleScores: Record<string, number> = {};

        for (const evaluator of evaluators) {
          const metric = evaluator.evaluate(results, sample.relevantIds);
          sampleScores[metric.name] = metric.score;
        }

        perSample.push(sampleScores);
      }
    }

    return this.buildReport(evaluators.map((e) => e.evaluate([], []).name), perSample);
  }

  /**
   * 运行生成评测
   *
   * 对每个样本用各指标评估 answer vs reference。
   *
   * @param evaluators - 生成评测器列表
   * @param dataset - 生成评测数据集
   * @returns 评测报告
   */
  async runGenerationBenchmark(
    evaluators: import('@rag-sdk/core').GenerationEvaluator[],
    dataset: GenerationSample[],
  ): Promise<BenchmarkReport> {
    const perSample: Array<Record<string, number>> = [];

    for (let i = 0; i < dataset.length; i += this.concurrency) {
      const batch = dataset.slice(i, i + this.concurrency);

      const batchResults = await Promise.all(
        batch.map(async (sample) => {
          const sampleScores: Record<string, number> = {};
          const contextStr = sample.contexts?.join('\n---\n');

          for (const evaluator of evaluators) {
            const metric = await evaluator.evaluate(
              sample.answer,
              sample.reference,
              contextStr ?? sample.query,
            );
            sampleScores[metric.name] = metric.score;
          }

          return sampleScores;
        }),
      );

      perSample.push(...batchResults);
    }

    // 获取指标名称列表
    const evaluatorNames: string[] = [];
    if (perSample.length > 0) {
      evaluatorNames.push(...Object.keys(perSample[0]!));
    }

    return this.buildReport(evaluatorNames, perSample);
  }

  /**
   * 构建评测报告
   *
   * @param evaluatorNames - 评测指标名称列表
   * @param perSample - 每个样本的各指标得分
   * @returns 评测报告
   */
  private buildReport(
    evaluatorNames: string[],
    perSample: Array<Record<string, number>>,
  ): BenchmarkReport {
    const metrics: Record<string, MetricStats> = {};

    for (const name of evaluatorNames) {
      const scores = perSample
        .map((s) => s[name])
        .filter((s): s is number => s !== undefined);

      if (scores.length === 0) {
        metrics[name] = { mean: 0, std: 0, min: 0, max: 0 };
        continue;
      }

      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
      const std = Math.sqrt(variance);

      metrics[name] = {
        mean,
        std,
        min: Math.min(...scores),
        max: Math.max(...scores),
      };
    }

    return {
      metrics,
      perSample,
      totalSamples: perSample.length,
      evaluators: evaluatorNames,
      timestamp: new Date().toISOString(),
    };
  }
}
