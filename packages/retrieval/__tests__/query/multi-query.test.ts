import { describe, it, expect, vi } from 'vitest';
import { MultiQueryExpander } from '../../src/query/multi-query';
import type { LLMProvider } from '@rag-sdk/core';

/** 创建 mock LLM：chatJson 抛异常（测试降级路径） */
function createMockLLMFallback(chatResponse: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue(chatResponse),
    chatStream: vi.fn(),
    chatJson: vi.fn().mockRejectedValue(new Error('chatJson not supported')),
  };
}

/** 创建 mock LLM：chatJson 返回结构化数据 */
function createMockLLMStructured<T>(result: T): LLMProvider {
  return {
    chat: vi.fn(),
    chatStream: vi.fn(),
    chatJson: vi.fn().mockResolvedValue(result),
  };
}

describe('MultiQueryExpander', () => {
  // === chatJson 结构化输出路径 ===

  it('should use chatJson for structured output', async () => {
    const llm = createMockLLMStructured({
      queries: ['TypeScript features', 'How to use TypeScript', 'TypeScript best practices'],
    });
    const expander = new MultiQueryExpander(llm, { numQueries: 3 });

    const result = await expander.transform('TypeScript');

    expect(result).toHaveLength(3);
    expect(result).toContain('TypeScript features');
    expect(llm.chatJson).toHaveBeenCalledOnce();
  });

  it('should pass temperature to chatJson options', async () => {
    const llm = createMockLLMStructured({ queries: ['v1', 'v2'] });
    const expander = new MultiQueryExpander(llm, { temperature: 0.9 });

    await expander.transform('test');

    const options = (llm.chatJson as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(options.temperature).toBe(0.9);
  });

  // === 降级路径（chatJson 抛异常） ===

  it('should fallback to chat + parse when chatJson fails', async () => {
    const llm = createMockLLMFallback('variant 1\nvariant 2\nvariant 3');
    const expander = new MultiQueryExpander(llm, { numQueries: 3 });

    const result = await expander.transform('test');

    expect(result).toHaveLength(3);
    expect(result).toContain('variant 1');
  });

  it('should pass numQueries in fallback prompt', async () => {
    const llm = createMockLLMFallback('v1\nv2\nv3\nv4\nv5');
    const expander = new MultiQueryExpander(llm, { numQueries: 5 });

    await expander.transform('test');

    const call = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const systemMessage = call[0][0];
    expect(systemMessage.content).toContain('5');
  });

  it('should filter out empty lines in fallback mode', async () => {
    const llm = createMockLLMFallback('variant 1\n\n\nvariant 2\n  \nvariant 3');
    const expander = new MultiQueryExpander(llm);

    const result = await expander.transform('test');
    expect(result).toHaveLength(3);
  });
});
