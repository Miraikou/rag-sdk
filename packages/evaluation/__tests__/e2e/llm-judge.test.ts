import { describe, it, expect, vi } from 'vitest'
import { E2ELLMJudge } from '../../src/e2e/llm-judge'
import type { LLMProvider } from '@rag-sdk/core'

/** 构建 mock LLMProvider */
function createMockLLM(chatJsonResponse?: unknown): LLMProvider {
  return {
    chat: vi.fn(async () => ''),
    chatStream: vi.fn(async function* () {}),
    chatJson: vi.fn(async () => chatJsonResponse ?? {
      scores: {
        '检索相关性': 8,
        '回答准确性': 7,
        '完整性': 6,
        '忠实度': 8,
        '有用性': 7,
      },
      overallScore: 7,
      feedback: '整体表现良好',
      dimensionReasons: {
        '检索相关性': '检索到的上下文高度相关',
        '回答准确性': '回答基本准确',
        '完整性': '部分信息缺失',
        '忠实度': '回答与上下文一致',
        '有用性': '对用户有帮助',
      },
    }),
  }
}

describe('E2ELLMJudge', () => {
  it('正常评估返回各维度评分', async () => {
    const llm = createMockLLM()
    const judge = new E2ELLMJudge({ judgeLLM: llm })

    const result = await judge.judge(
      '什么是向量数据库？',
      '向量数据库是专门用于存储和检索高维向量的数据库系统',
      ['向量数据库用于存储高维向量数据'],
    )

    expect(result.scores).toBeDefined()
    expect(result.overallScore).toBe(7)
    expect(result.feedback).toBe('整体表现良好')
    expect(Object.keys(result.dimensionReasons).length).toBe(5)
  })

  it('支持自定义评估维度', async () => {
    const llm = createMockLLM({
      scores: { '准确性': 8, '完整性': 7 },
      overallScore: 8,
      feedback: '好',
      dimensionReasons: { '准确性': '准确', '完整性': '基本完整' },
    })
    const judge = new E2ELLMJudge({
      judgeLLM: llm,
      dimensions: ['准确性', '完整性'],
    })

    const result = await judge.judge('测试查询', '测试回答', ['上下文'])

    expect(result.scores['准确性']).toBe(8)
    expect(result.scores['完整性']).toBe(7)
  })

  it('LLM 失败时降级为中间值评分', async () => {
    const llm: LLMProvider = {
      chat: vi.fn(async () => ''),
      chatStream: vi.fn(async function* () {}),
      chatJson: vi.fn(async () => {
        throw new Error('LLM failed')
      }),
    }
    const judge = new E2ELLMJudge({ judgeLLM: llm })

    const result = await judge.judge('查询', '回答', ['上下文'])

    // 降级：所有维度得分为 5（中间值）
    expect(result.overallScore).toBe(5)
    expect(result.feedback).toBe('LLM 评估失败')
    for (const score of Object.values(result.scores)) {
      expect(score).toBe(5)
    }
  })

  it('默认使用 5 个评估维度', async () => {
    const llm = createMockLLM()
    const judge = new E2ELLMJudge({ judgeLLM: llm })

    const result = await judge.judge('查询', '回答', ['上下文'])

    expect(Object.keys(result.scores).length).toBe(5)
  })
})
