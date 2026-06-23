import { describe, it, expect } from 'vitest'
import { EvaluationReport } from '../src/report'
import type { BenchmarkReport, E2EJudgeResult, ABTestReport } from '../src/types'

/** 构建 mock BenchmarkReport */
function createMockBenchmarkReport(
  metrics: Record<string, number>,
): BenchmarkReport {
  const metricStats: BenchmarkReport['metrics'] = {}
  for (const [name, mean] of Object.entries(metrics)) {
    metricStats[name] = { mean, std: 0, min: mean, max: mean }
  }
  return {
    metrics: metricStats,
    perSample: [],
    totalSamples: 10,
    evaluators: Object.keys(metrics),
    timestamp: new Date().toISOString(),
  }
}

describe('EvaluationReport', () => {
  it('生成包含所有模块的完整报告', () => {
    const report = new EvaluationReport()

    report.setRetrievalReport(
      createMockBenchmarkReport({ 'Recall@K': 0.8, 'Precision@K': 0.7 }),
    )
    report.setGenerationReport(
      createMockBenchmarkReport({ Faithfulness: 0.9, BLEU: 0.4 }),
    )

    const fullReport = report.generateReport()

    expect(fullReport.timestamp).toBeDefined()
    expect(fullReport.summary.totalSamples).toBe(20)
    expect(fullReport.summary.overallScore).toBeGreaterThan(0)
    expect(fullReport.retrieval).toBeDefined()
    expect(fullReport.generation).toBeDefined()
  })

  it('检索指标低时生成改进建议', () => {
    const report = new EvaluationReport()
    report.setRetrievalReport(
      createMockBenchmarkReport({ 'Recall@K': 0.5 }),
    )

    const fullReport = report.generateReport()

    expect(fullReport.recommendations.length).toBeGreaterThan(0)
    expect(fullReport.recommendations[0]).toContain('Recall@K')
  })

  it('生成指标低时生成改进建议', () => {
    const report = new EvaluationReport()
    report.setGenerationReport(
      createMockBenchmarkReport({ Faithfulness: 0.6 }),
    )

    const fullReport = report.generateReport()

    expect(fullReport.recommendations.length).toBeGreaterThan(0)
    expect(fullReport.recommendations[0]).toContain('Faithfulness')
  })

  it('所有指标良好时返回无改进建议', () => {
    const report = new EvaluationReport()
    report.setRetrievalReport(
      createMockBenchmarkReport({ 'Recall@K': 0.9, 'Precision@K': 0.9, 'NDCG@K': 0.9 }),
    )
    report.setGenerationReport(
      createMockBenchmarkReport({ Faithfulness: 0.95, AnswerRelevance: 0.9, BLEU: 0.5 }),
    )

    const fullReport = report.generateReport()

    expect(fullReport.recommendations[0]).toContain('各项指标表现良好')
  })

  it('综合评定：优秀', () => {
    const report = new EvaluationReport()
    report.setRetrievalReport(
      createMockBenchmarkReport({ 'Recall@K': 0.95 }),
    )

    const fullReport = report.generateReport()

    expect(fullReport.summary.verdict).toBe('优秀')
  })

  it('综合评定：需改进', () => {
    const report = new EvaluationReport()
    report.setRetrievalReport(
      createMockBenchmarkReport({ 'Recall@K': 0.3 }),
    )

    const fullReport = report.generateReport()

    expect(fullReport.summary.verdict).toBe('需改进')
  })

  it('包含 E2E LLM Judge 结果', () => {
    const report = new EvaluationReport()
    const judgeResults: E2EJudgeResult[] = [
      {
        scores: { '检索相关性': 8, '回答准确性': 7 },
        overallScore: 7.5,
        feedback: '良好',
        dimensionReasons: {},
      },
    ]
    report.setE2EJudgeResults(judgeResults)

    const fullReport = report.generateReport()

    expect(fullReport.e2e).toBeDefined()
    expect(fullReport.e2e!.llmJudgeScores).toBeDefined()
    expect(fullReport.e2e!.llmJudgeScores!['检索相关性']).toBe(8)
  })

  it('包含 A/B 测试报告', () => {
    const report = new EvaluationReport()
    const abReport: ABTestReport = {
      satisfactionA: 0.7,
      satisfactionB: 0.5,
      countA: 50,
      countB: 50,
      zScore: 2.5,
      pValue: 0.01,
      significant: true,
      winner: 'A',
    }
    report.setABTestReport(abReport)

    const fullReport = report.generateReport()

    expect(fullReport.e2e).toBeDefined()
    expect(fullReport.e2e!.abTest).toBeDefined()
    expect(fullReport.e2e!.abTest!.winner).toBe('A')
  })

  it('空报告时综合评分为 0', () => {
    const report = new EvaluationReport()
    const fullReport = report.generateReport()

    expect(fullReport.summary.overallScore).toBe(0)
    expect(fullReport.summary.totalSamples).toBe(0)
  })
})
