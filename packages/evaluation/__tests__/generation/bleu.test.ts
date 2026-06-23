import { describe, it, expect } from 'vitest'
import { BLEUEvaluator } from '../../src/generation/bleu'

describe('BLEUEvaluator', () => {
  it('完全相同文本得分为 1', () => {
    const evaluator = new BLEUEvaluator()
    const result = evaluator.evaluate('今天天气很好', '今天天气很好')

    expect(result.name).toBe('BLEU')
    expect(result.score).toBeCloseTo(1)
  })

  it('部分重叠文本得分在 0-1 之间', () => {
    const evaluator = new BLEUEvaluator()
    const result = evaluator.evaluate('今天天气很好', '今天天气非常好')

    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(1)
  })

  it('完全不同文本得分为 0', () => {
    const evaluator = new BLEUEvaluator()
    const result = evaluator.evaluate('abc def ghi', 'xyz uvw rst')

    expect(result.score).toBe(0)
  })

  it('回答为空时得分为 0', () => {
    const evaluator = new BLEUEvaluator()
    const result = evaluator.evaluate('', '今天天气很好')

    expect(result.score).toBe(0)
    expect(result.reason).toBe('回答为空')
  })

  it('参考为空时得分为 0', () => {
    const evaluator = new BLEUEvaluator()
    const result = evaluator.evaluate('今天天气很好', '')

    expect(result.score).toBe(0)
    expect(result.reason).toBe('参考为空')
  })

  it('短回答受简短惩罚影响', () => {
    const evaluator = new BLEUEvaluator()
    const result = evaluator.evaluate('好', '今天天气很好')

    // 短回答会有简短惩罚
    expect(result.details).toBeDefined()
    expect(result.details!.brevityPenalty).toBeLessThan(1)
  })

  it('BLEU-1 只计算 unigram', () => {
    const evaluator = new BLEUEvaluator({ maxN: 1 })
    const result = evaluator.evaluate('今天 天气 很好', '今天 天气 很好')

    expect(result.name).toBe('BLEU')
    expect(result.score).toBeCloseTo(1)
  })

  it('支持英文文本', () => {
    const evaluator = new BLEUEvaluator({ maxN: 1 })
    const result = evaluator.evaluate(
      'the cat sat on the mat',
      'the cat is on the mat',
    )

    // BLEU-1: 5/6 unigrams match
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(1)
  })
})
