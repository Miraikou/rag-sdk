import { describe, it, expect } from 'vitest'
import { ABTestAnalyzer } from '../../src/e2e/ab-test'
import type { ABTestEvent } from '../../src/types'

describe('ABTestAnalyzer', () => {
  it('A 组显著优于 B 组', () => {
    const analyzer = new ABTestAnalyzer()

    // A 组：大部分正面反馈
    const eventsA: ABTestEvent[] = Array.from({ length: 50 }, () => ({
      group: 'A' as const,
      thumbsUp: true,
      sourceClick: true,
      dwellTime: 45,
    }))

    // B 组：大部分负面反馈
    const eventsB: ABTestEvent[] = Array.from({ length: 50 }, () => ({
      group: 'B' as const,
      followUp: true,
      dwellTime: 5,
    }))

    analyzer.collectEvents([...eventsA, ...eventsB])
    const report = analyzer.analyze()

    expect(report.countA).toBe(50)
    expect(report.countB).toBe(50)
    expect(report.satisfactionA).toBeGreaterThan(report.satisfactionB)
    expect(report.significant).toBe(true)
    expect(report.winner).toBe('A')
  })

  it('两组无显著差异时为 tie', () => {
    const analyzer = new ABTestAnalyzer()

    // 两组完全相同的反馈
    const events: ABTestEvent[] = []
    for (let i = 0; i < 30; i++) {
      events.push({ group: 'A', thumbsUp: true, dwellTime: 30 })
      events.push({ group: 'B', thumbsUp: true, dwellTime: 30 })
    }

    analyzer.collectEvents(events)
    const report = analyzer.analyze()

    expect(report.satisfactionA).toBe(report.satisfactionB)
    expect(report.zScore).toBeCloseTo(0)
    expect(report.significant).toBe(false)
    expect(report.winner).toBe('tie')
  })

  it('样本不足时返回保守结果', () => {
    const analyzer = new ABTestAnalyzer()

    analyzer.collectEvent({ group: 'A', thumbsUp: true })

    const report = analyzer.analyze()

    expect(report.significant).toBe(false)
    expect(report.winner).toBe('tie')
    expect(report.pValue).toBe(1)
  })

  it('支持批量收集事件', () => {
    const analyzer = new ABTestAnalyzer()
    const events: ABTestEvent[] = [
      { group: 'A', thumbsUp: true },
      { group: 'A', thumbsUp: true },
      { group: 'B', followUp: true },
      { group: 'B', followUp: true },
    ]

    analyzer.collectEvents(events)
    const report = analyzer.analyze()

    expect(report.countA).toBe(2)
    expect(report.countB).toBe(2)
  })

  it('满意度权重正确计算', () => {
    const analyzer = new ABTestAnalyzer()

    // 全正面：thumbsUp(0.4) + sourceClick(0.15) + dwellTime>30(0.15) = 0.7
    analyzer.collectEvent({
      group: 'A',
      thumbsUp: true,
      sourceClick: true,
      dwellTime: 45,
    })
    analyzer.collectEvent({
      group: 'A',
      thumbsUp: true,
      sourceClick: true,
      dwellTime: 45,
    })

    // 全负面：followUp(-0.3) → clamp to 0
    analyzer.collectEvent({ group: 'B', followUp: true })
    analyzer.collectEvent({ group: 'B', followUp: true })

    const report = analyzer.analyze()

    expect(report.satisfactionA).toBeCloseTo(0.7)
    expect(report.satisfactionB).toBe(0)
  })

  it('可自定义置信水平', () => {
    const analyzer = new ABTestAnalyzer(0.99)

    const events: ABTestEvent[] = []
    for (let i = 0; i < 20; i++) {
      events.push({ group: 'A', thumbsUp: true })
      events.push({ group: 'B', thumbsUp: true })
    }

    analyzer.collectEvents(events)
    const report = analyzer.analyze()

    // 相同反馈，99% 置信水平下不显著
    expect(report.significant).toBe(false)
  })
})
