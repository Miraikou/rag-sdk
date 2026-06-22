import { describe, it, expect, vi } from 'vitest';
import { QueryDecomposer } from '../../src/query/decomposition';
import type { LLMProvider } from '@rag-sdk/core';

function createMockLLM(response: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue(response),
    chatStream: vi.fn(),
  };
}

describe('QueryDecomposer', () => {
  it('should decompose complex query into sub-queries', async () => {
    const llm = createMockLLM('What is RAG?\nHow does retrieval work?\nWhat is generation in NLP?');
    const decomposer = new QueryDecomposer(llm);

    const result = await decomposer.transform('What is RAG and how does retrieval and generation work?');

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('What is RAG?');
    expect(result[1]).toBe('How does retrieval work?');
    expect(result[2]).toBe('What is generation in NLP?');
  });

  it('should strip numbered prefixes from LLM output', async () => {
    const llm = createMockLLM('1. First question\n2. Second question\n3) Third question');
    const decomposer = new QueryDecomposer(llm);

    const result = await decomposer.transform('complex question');

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('First question');
    expect(result[1]).toBe('Second question');
    expect(result[2]).toBe('Third question');
  });

  it('should return original query when LLM returns empty', async () => {
    const llm = createMockLLM('');
    const decomposer = new QueryDecomposer(llm);

    const result = await decomposer.transform('simple question');
    expect(result).toEqual(['simple question']);
  });

  it('should pass maxSubQueries in the prompt', async () => {
    const llm = createMockLLM('sub1\nsub2\nsub3');
    const decomposer = new QueryDecomposer(llm, { maxSubQueries: 3 });

    await decomposer.transform('test');

    const call = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const systemMessage = call[0][0];
    expect(systemMessage.content).toContain('3');
  });
});
