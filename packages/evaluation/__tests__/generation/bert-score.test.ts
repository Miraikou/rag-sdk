import { describe, it, expect, vi } from 'vitest'
import { BERTScoreEvaluator } from '../../src/generation/bert-score'
import type { EmbeddingProvider } from '@rag-sdk/core'

/** 构建 mock EmbeddingProvider */
function createMockEmbedding(): EmbeddingProvider {
  return {
    embed: vi.fn(async (text: string) => {
      // 简单哈希生成确定性向量
      const hash = text.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      const dim = 3
      return Array.from({ length: dim }, (_, i) => Math.sin(hash + i))
    }),
    embedBatch: vi.fn(async (texts: string[]) => {
      return Promise.all(texts.map((t) => createMockEmbedding().embed(t)))
    }),
    dimension: 3,
  }
}

describe('BERTScoreEvaluator', () => {
  it('相同文本语义相似度接近 1', async () => {
    const embedding = createMockEmbedding()
    const evaluator = new BERTScoreEvaluator(embedding)

    const result = await evaluator.evaluate('今天天气很好', '今天天气很好')

    expect(result.name).toBe('SemanticSimilarity')
    expect(result.score).toBeCloseTo(1)
  })

  it('不同文本语义相似度在 0-1 之间', async () => {
    const embedding = createMockEmbedding()
    const evaluator = new BERTScoreEvaluator(embedding)

    const result = await evaluator.evaluate('今天天气很好', '明天会下雨')

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })

  it('回答为空时得分为 0', async () => {
    const embedding = createMockEmbedding()
    const evaluator = new BERTScoreEvaluator(embedding)

    const result = await evaluator.evaluate('', '今天天气很好')

    expect(result.score).toBe(0)
    expect(result.reason).toBe('回答为空')
  })

  it('参考为空时得分为 0', async () => {
    const embedding = createMockEmbedding()
    const evaluator = new BERTScoreEvaluator(embedding)

    const result = await evaluator.evaluate('今天天气很好', '')

    expect(result.score).toBe(0)
    expect(result.reason).toBe('参考为空')
  })

  it('调用 embed 两次（answer + reference 各一次）', async () => {
    const embedding = createMockEmbedding()
    const evaluator = new BERTScoreEvaluator(embedding)

    await evaluator.evaluate('你好', '世界')

    expect(embedding.embed).toHaveBeenCalledTimes(2)
  })
})
