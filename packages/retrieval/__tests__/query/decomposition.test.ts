import { describe, it, expect, vi } from 'vitest';
import { QueryDecomposer } from '../../src/query/decomposition';
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

describe('QueryDecomposer', () => {
  // === chatJson 结构化输出路径 ===

  it('should use chatJson for structured output', async () => {
    const llm = createMockLLMStructured({ subQueries: ['What is RAG?', 'How does retrieval work?'] });
    const decomposer = new QueryDecomposer(llm);

    const result = await decomposer.transform('What is RAG and how does retrieval work?');

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('What is RAG?');
    expect(result[1]).toBe('How does retrieval work?');
    expect(llm.chatJson).toHaveBeenCalledOnce();
  });

  it('should pass schema to chatJson', async () => {
    const llm = createMockLLMStructured({ subQueries: ['test'] });
    const decomposer = new QueryDecomposer(llm);

    await decomposer.transform('test');

    const schema = (llm.chatJson as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(schema).toBeDefined();
    expect(schema.type).toBe('object');
  });

  // === 降级路径（chatJson 抛异常） ===

  it('should fallback to chat + parse when chatJson fails', async () => {
    const llm = createMockLLMFallback('What is RAG?\nHow does retrieval work?');
    const decomposer = new QueryDecomposer(llm);

    const result = await decomposer.transform('complex question');

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('What is RAG?');
    expect(result[1]).toBe('How does retrieval work?');
  });

  it('should strip numbered prefixes in fallback mode', async () => {
    const llm = createMockLLMFallback('1. First question\n2. Second question\n3) Third question');
    const decomposer = new QueryDecomposer(llm);

    const result = await decomposer.transform('complex question');

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('First question');
    expect(result[1]).toBe('Second question');
    expect(result[2]).toBe('Third question');
  });

  it('should return original query when fallback returns empty', async () => {
    const llm = createMockLLMFallback('');
    const decomposer = new QueryDecomposer(llm);

    const result = await decomposer.transform('simple question');
    expect(result).toEqual(['simple question']);
  });
});
