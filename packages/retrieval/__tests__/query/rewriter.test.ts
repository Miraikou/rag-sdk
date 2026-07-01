import { describe, it, expect, vi } from 'vitest';
import { QueryRewriter } from '../../src/query/rewriter';
import type { LLMProvider, Message } from '@ragsdk/core';

function createMockLLM(response: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue(response),
    chatStream: vi.fn(),
  };
}

describe('QueryRewriter', () => {
  it('should rewrite query using LLM', async () => {
    const llm = createMockLLM('  TypeScript programming language features  ');
    const rewriter = new QueryRewriter(llm);

    const result = await rewriter.transform('ts咋用');

    expect(result).toBe('TypeScript programming language features');
    expect(llm.chat).toHaveBeenCalledOnce();

    const messages = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as Message[];
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.role).toBe('user');
    expect(messages[1]!.content).toBe('ts咋用');
  });

  it('should support custom rewrite prompt', async () => {
    const llm = createMockLLM('rewritten query');
    const customPrompt = '你是翻译助手，请将中文翻译为英文';
    const rewriter = new QueryRewriter(llm, customPrompt);

    await rewriter.transform('测试');

    const messages = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0][0] as Message[];
    expect(messages[0]!.content).toBe(customPrompt);
  });
});
