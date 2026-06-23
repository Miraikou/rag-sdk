import { describe, it, expect, vi } from 'vitest'
import { FaithfulnessEvaluator } from '../../src/generation/faithfulness'
import type { LLMProvider } from '@rag-sdk/core'

/** 构建 mock LLMProvider */
function createMockLLM(chatJsonResponses?: unknown[]): LLMProvider {
  let callIndex = 0
  return {
    chat: vi.fn(async () => ''),
    chatStream: vi.fn(async function* () {}),
    chatJson: vi.fn(async () => {
      if (chatJsonResponses && callIndex < chatJsonResponses.length) {
        return chatJsonResponses[callIndex++]
      }
      return {}
    }),
  }
}

describe('FaithfulnessEvaluator', () => {
  it('所有声明均被支持时得分为 1', async () => {
    const llm = createMockLLM([
      { claims: ['地球是圆的', '太阳是恒星'] },
      {
        verdicts: [
          { claim: '地球是圆的', supported: true, reason: '上下文明确提到' },
          { claim: '太阳是恒星', supported: true, reason: '上下文明确提到' },
        ],
      },
    ])
    const evaluator = new FaithfulnessEvaluator(llm)

    const result = await evaluator.evaluate(
      '地球是圆的，太阳是恒星',
      '',
      '地球是一个近似球体，太阳是一颗恒星',
    )

    expect(result.name).toBe('Faithfulness')
    expect(result.score).toBe(1)
  })

  it('部分声明不被支持时得分 < 1', async () => {
    const llm = createMockLLM([
      { claims: ['地球是圆的', '月亮是行星'] },
      {
        verdicts: [
          { claim: '地球是圆的', supported: true, reason: '上下文支持' },
          { claim: '月亮是行星', supported: false, reason: '上下文未提及' },
        ],
      },
    ])
    const evaluator = new FaithfulnessEvaluator(llm)

    const result = await evaluator.evaluate(
      '地球是圆的，月亮是行星',
      '',
      '地球是一个近似球体',
    )

    expect(result.score).toBeCloseTo(0.5)
  })

  it('无上下文时得分为 0', async () => {
    const llm = createMockLLM()
    const evaluator = new FaithfulnessEvaluator(llm)

    const result = await evaluator.evaluate('地球是圆的', '')

    expect(result.score).toBe(0)
    expect(result.reason).toBe('未提供上下文，无法验证忠实度')
  })

  it('LLM 失败时降级为句子拆分', async () => {
    const llm: LLMProvider = {
      chat: vi.fn(async () => ''),
      chatStream: vi.fn(async function* () {}),
      chatJson: vi.fn(async () => {
        throw new Error('LLM failed')
      }),
    }
    const evaluator = new FaithfulnessEvaluator(llm)

    const result = await evaluator.evaluate(
      'The earth is round. The sun is a star.',
      '',
      'The earth is approximately round. The sun is classified as a star.',
    )

    // 降级方案：按句号拆分声明，用关键词匹配验证
    expect(result.name).toBe('Faithfulness')
    expect(result.score).toBeGreaterThan(0)
  })

  it('零声明视为完全忠实（得分 1）', async () => {
    const llm = createMockLLM([{ claims: [] }])
    const evaluator = new FaithfulnessEvaluator(llm)

    const result = await evaluator.evaluate('', '', '一些上下文')

    expect(result.score).toBe(1)
  })
})
