import { describe, it, expect, vi } from 'vitest';
import { AnswerRelevanceEvaluator } from '../../src/generation/relevance';
import type { LLMProvider } from '@rag-sdk/core';

/** 构建 mock LLMProvider */
function createMockLLM(chatJsonResponse?: unknown): LLMProvider {
  return {
    chat: vi.fn(async () => ''),
    chatStream: vi.fn(async function* () {}),
    chatJson: vi.fn(async () => chatJsonResponse ?? {}),
  };
}

describe('AnswerRelevanceEvaluator', () => {
  it('反向问题与查询高度相关时得分高', async () => {
    const llm = createMockLLM({
      questions: ['什么是向量数据库？', '向量数据库有什么用途？'],
    });
    const evaluator = new AnswerRelevanceEvaluator(llm);

    const result = await evaluator.evaluate(
      '向量数据库是一种专门用于存储和检索高维向量的数据库系统，广泛用于语义搜索和推荐系统。',
      '什么是向量数据库',
    );

    expect(result.name).toBe('AnswerRelevance');
    expect(result.score).toBeGreaterThan(0);
  });

  it('回答或查询为空时得分为 0', async () => {
    const llm = createMockLLM();
    const evaluator = new AnswerRelevanceEvaluator(llm);

    const result = await evaluator.evaluate('', '什么是向量数据库');

    expect(result.score).toBe(0);
    expect(result.reason).toContain('空');
  });

  it('LLM 失败时降级为关键词重叠', async () => {
    const llm: LLMProvider = {
      chat: vi.fn(async () => ''),
      chatStream: vi.fn(async function* () {}),
      chatJson: vi.fn(async () => {
        throw new Error('LLM failed');
      }),
    };
    const evaluator = new AnswerRelevanceEvaluator(llm);

    const result = await evaluator.evaluate('向量数据库用于存储向量', '向量数据库');

    expect(result.name).toBe('AnswerRelevance');
    // 降级为关键词重叠，应 > 0
    expect(result.score).toBeGreaterThan(0);
  });

  it('可配置反向问题数量', async () => {
    const llm = createMockLLM({
      questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
    });
    const evaluator = new AnswerRelevanceEvaluator(llm, { numQuestions: 5 });

    const result = await evaluator.evaluate('这是一段很长的回答内容', '测试查询');

    expect(result.name).toBe('AnswerRelevance');
    expect(result.details?.numQuestions).toBe(5);
  });
});
