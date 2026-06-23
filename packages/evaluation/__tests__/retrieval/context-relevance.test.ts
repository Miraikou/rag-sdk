import { describe, it, expect, vi } from 'vitest'
import { ContextRelevanceEvaluator } from '../../src/retrieval/context-relevance'
import type { LLMProvider } from '@rag-sdk/core'

/** 构建 mock LLMProvider */
function createMockLLM(chatJsonResponse?: unknown): LLMProvider {
  return {
    chat: vi.fn(async () => ''),
    chatStream: vi.fn(async function* () {}),
    chatJson: vi.fn(async () => chatJsonResponse ?? {}),
  }
}

describe('ContextRelevanceEvaluator', () => {
  it('所有上下文均相关时得分为 1', async () => {
    const llm = createMockLLM({
      judgments: [
        { index: 0, relevant: true, reason: '直接相关' },
        { index: 1, relevant: true, reason: '直接相关' },
      ],
    })
    const evaluator = new ContextRelevanceEvaluator(llm)

    const result = await evaluator.evaluate('什么是向量数据库', [
      '向量数据库用于存储高维向量',
      '向量数据库支持近似最近邻搜索',
    ])

    expect(result.name).toBe('ContextRelevance')
    expect(result.score).toBeCloseTo(1)
  })

  it('部分上下文相关时得分 < 1', async () => {
    const llm = createMockLLM({
      judgments: [
        { index: 0, relevant: false, reason: '不相关' },
        { index: 1, relevant: true, reason: '直接相关' },
      ],
    })
    const evaluator = new ContextRelevanceEvaluator(llm)

    const result = await evaluator.evaluate('什么是向量数据库', [
      '今天天气很好，适合出去散步',
      '向量数据库用于存储高维向量',
    ])

    // AP: 第一个不相关，第二个相关 → P@2 = 1/2
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(1)
  })

  it('无上下文时得分为 0', async () => {
    const llm = createMockLLM()
    const evaluator = new ContextRelevanceEvaluator(llm)

    const result = await evaluator.evaluate('什么是向量数据库', [])

    expect(result.score).toBe(0)
  })

  it('LLM 失败时降级为 Jaccard 关键词重叠', async () => {
    const llm: LLMProvider = {
      chat: vi.fn(async () => ''),
      chatStream: vi.fn(async function* () {}),
      chatJson: vi.fn(async () => {
        throw new Error('LLM failed')
      }),
    }
    const evaluator = new ContextRelevanceEvaluator(llm)

    const result = await evaluator.evaluate('vector database', [
      'a vector database stores vector data',
      'today is a sunny day',
    ])

    // 降级方案：第一个上下文与查询有词重叠，第二个无
    expect(result.name).toBe('ContextRelevance')
    expect(result.score).toBeGreaterThan(0)
  })

  it('支持 k 值截取上下文', async () => {
    const llm = createMockLLM({
      judgments: [
        { index: 0, relevant: true, reason: '直接相关' },
      ],
    })
    const evaluator = new ContextRelevanceEvaluator(llm, { k: 1 })

    const result = await evaluator.evaluate('向量数据库', [
      '向量数据库用于存储高维向量',
      '今天天气很好',
      '无关的上下文',
    ])

    // k=1 只评估第一个
    expect(result.details?.totalContexts).toBe(1)
  })
})
