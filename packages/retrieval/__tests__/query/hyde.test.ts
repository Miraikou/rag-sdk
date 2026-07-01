import { describe, it, expect, vi } from 'vitest';
import { HyDETransformer } from '../../src/query/hyde';
import type { LLMProvider } from '@ragsdk/core';

function createMockLLM(response: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue(response),
    chatStream: vi.fn(),
  };
}

describe('HyDETransformer', () => {
  it('should generate hypothetical document from query', async () => {
    const llm = createMockLLM('  TypeScript is a typed superset of JavaScript developed by Microsoft.  ');
    const hyde = new HyDETransformer(llm);

    const result = await hyde.transform('What is TypeScript?');

    expect(result).toBe('TypeScript is a typed superset of JavaScript developed by Microsoft.');
    expect(llm.chat).toHaveBeenCalledOnce();
  });

  it('should support custom generate prompt', async () => {
    const llm = createMockLLM('hypothetical answer');
    const customPrompt = 'Generate a technical document excerpt';
    const hyde = new HyDETransformer(llm, customPrompt);

    await hyde.transform('test query');

    const call = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const systemMessage = call[0][0];
    expect(systemMessage.content).toBe(customPrompt);
  });

  it('should send query as user message', async () => {
    const llm = createMockLLM('answer');
    const hyde = new HyDETransformer(llm);

    await hyde.transform('my specific query');

    const call = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = call[0];
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('my specific query');
  });
});
