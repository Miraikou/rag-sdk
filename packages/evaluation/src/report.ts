import type { ABTestReport, BenchmarkReport, E2EJudgeResult, FullReport } from './types';

/**
 * 评测报告生成器
 *
 * 聚合检索、生成、端到端评测结果，
 * 基于阈值规则生成改进建议。
 */
export class EvaluationReport {
  private retrievalReport?: BenchmarkReport;
  private generationReport?: BenchmarkReport;
  private e2eJudgeResults?: E2EJudgeResult[];
  private abTestReport?: ABTestReport;

  /**
   * 设置检索评测结果
   *
   * @param report - 检索评测报告
   */
  setRetrievalReport(report: BenchmarkReport): void {
    this.retrievalReport = report;
  }

  /**
   * 设置生成评测结果
   *
   * @param report - 生成评测报告
   */
  setGenerationReport(report: BenchmarkReport): void {
    this.generationReport = report;
  }

  /**
   * 设置端到端 LLM 裁判结果
   *
   * @param results - LLM 裁判结果列表
   */
  setE2EJudgeResults(results: E2EJudgeResult[]): void {
    this.e2eJudgeResults = results;
  }

  /**
   * 设置 A/B 测试报告
   *
   * @param report - A/B 测试报告
   */
  setABTestReport(report: ABTestReport): void {
    this.abTestReport = report;
  }

  /**
   * 生成完整评测报告
   *
   * 聚合所有评测结果，计算综合评分，生成改进建议。
   *
   * @returns 完整评测报告
   */
  generateReport(): FullReport {
    const recommendations = this.generateRecommendations();
    const overallScore = this.computeOverallScore();
    const totalSamples = this.computeTotalSamples();
    const verdict = this.computeVerdict(overallScore);

    const report: FullReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSamples,
        overallScore,
        verdict,
      },
      recommendations,
    };

    if (this.retrievalReport) {
      report.retrieval = this.retrievalReport;
    }

    if (this.generationReport) {
      report.generation = this.generationReport;
    }

    if (this.e2eJudgeResults || this.abTestReport) {
      report.e2e = {};
      if (this.e2eJudgeResults && this.e2eJudgeResults.length > 0) {
        // 平均各维度评分
        const dimScores: Record<string, number[]> = {};
        for (const result of this.e2eJudgeResults) {
          for (const [dim, score] of Object.entries(result.scores)) {
            const arr = dimScores[dim] ?? (dimScores[dim] = []);
            arr.push(score);
          }
        }
        report.e2e.llmJudgeScores = {};
        for (const [dim, scores] of Object.entries(dimScores)) {
          report.e2e.llmJudgeScores[dim] = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
      }
      if (this.abTestReport) {
        report.e2e.abTest = this.abTestReport;
      }
    }

    return report;
  }

  /**
   * 计算综合评分（0-1）
   */
  private computeOverallScore(): number {
    const scores: number[] = [];

    if (this.retrievalReport) {
      for (const stats of Object.values(this.retrievalReport.metrics)) {
        scores.push(stats.mean);
      }
    }

    if (this.generationReport) {
      for (const stats of Object.values(this.generationReport.metrics)) {
        scores.push(stats.mean);
      }
    }

    if (this.e2eJudgeResults && this.e2eJudgeResults.length > 0) {
      const avgOverall =
        this.e2eJudgeResults.reduce((sum, r) => sum + r.overallScore, 0) /
        this.e2eJudgeResults.length;
      // 归一化 1-10 到 0-1
      scores.push(avgOverall / 10);
    }

    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * 计算总样本数
   */
  private computeTotalSamples(): number {
    let total = 0;
    if (this.retrievalReport) total += this.retrievalReport.totalSamples;
    if (this.generationReport) total += this.generationReport.totalSamples;
    if (this.e2eJudgeResults) total += this.e2eJudgeResults.length;
    return total;
  }

  /**
   * 计算综合评定
   */
  private computeVerdict(score: number): string {
    if (score >= 0.9) return '优秀';
    if (score >= 0.75) return '良好';
    if (score >= 0.6) return '及格';
    return '需改进';
  }

  /**
   * 基于阈值规则生成改进建议
   */
  private generateRecommendations(): string[] {
    const recs: string[] = [];

    // 检索指标建议
    if (this.retrievalReport) {
      const recall = this.retrievalReport.metrics['Recall@K'];
      if (recall && recall.mean < 0.7) {
        recs.push(
          'Recall@K 低于 0.7，建议：优化嵌入模型、调整切块策略（增大 chunkSize 或尝试语义切块）、增加查询变换',
        );
      }

      const precision = this.retrievalReport.metrics['Precision@K'];
      if (precision && precision.mean < 0.6) {
        recs.push('Precision@K 低于 0.6，建议：改进嵌入模型质量、添加重排序后处理器、调整检索阈值');
      }

      const ndcg = this.retrievalReport.metrics['NDCG@K'];
      if (ndcg && ndcg.mean < 0.7) {
        recs.push('NDCG@K 低于 0.7，建议：优化检索排序策略、引入 Reranker 后处理器');
      }
    }

    // 生成指标建议
    if (this.generationReport) {
      const faithfulness = this.generationReport.metrics['Faithfulness'];
      if (faithfulness && faithfulness.mean < 0.8) {
        recs.push(
          'Faithfulness 低于 0.8，存在幻觉风险，建议：在 prompt 中加强"仅基于提供的上下文回答"约束、使用 GroundingGenerator',
        );
      }

      const relevance = this.generationReport.metrics['AnswerRelevance'];
      if (relevance && relevance.mean < 0.7) {
        recs.push(
          'AnswerRelevance 低于 0.7，回答偏离问题，建议：优化 prompt 模板、检查检索上下文的相关性',
        );
      }

      const bleu = this.generationReport.metrics['BLEU'];
      if (bleu && bleu.mean < 0.3) {
        // 模型生成的文本，与人工参考答案有多相似？
        recs.push('BLEU 低于 0.3，回答与参考差异较大，建议：检查 prompt 设计、增加 few-shot 示例');
      }
    }

    if (recs.length === 0) {
      recs.push('各项指标表现良好，暂无改进建议');
    }

    return recs;
  }
}
