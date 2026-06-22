import { describe, it, expect, vi } from 'vitest';
import { MultiQueryExpander } from '../../src/query/multi-query';
import type { LLMProvider } from '@rag-sdk/core';

function createMockLLM(response: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue(response),
    chatStream: vi.fn(),
  };
}

describe('MultiQueryExpander', () => {
  it('should expand query into multiple variants', async () => {
    const llm = createMockLLM('TypeScript language features\nHow to use TypeScript\nTypeScript best practices');
    const expander = new MultiQueryExpander(llm, { numQueries: 3 });

    const result = await expander.transform('TypeScript');

    expect(result).toHaveLength(3);
    expect(result).toContain('TypeScript language features');
    expect(result).toContain('How to use TypeScript');
    expect(result).toContain('TypeScript best practices');
  });

  it('should pass numQueries in the system prompt', async () => {
    const llm = createMockLLM('variant 1\nvariant 2\nvariant 3\nvariant 4\nvariant 5');
    const expander = new MultiQueryExpander(llm, { numQueries: 5 });

    await expander.transform('test');

    const call = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const systemMessage = call[0][0];
    expect(systemMessage.content).toContain('5');
  });

  it('should pass temperature to LLM', async () => {
    const llm = createMockLLM('variant 1');
    const expander = new MultiQueryExpander(llm, { temperature: 0.9 });

    await expander.transform('test');

    const call = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = call[1];
    expect(options.temperature).toBe(0.9);
  });

  it('should filter out empty lines', async () => {
    const llm = createMockLLM('variant 1\n\n\nvariant 2\n  \nvariant 3');
    const expander = new MultiQueryExpander(llm);

    const result = await expander.transform('test');
    expect(result).toHaveLength(3);
  });
});
