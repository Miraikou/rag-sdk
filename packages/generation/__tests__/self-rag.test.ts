import { describe, it, expect, vi } from 'vitest';
import { SelfRAGGenerator } from '../src/self-rag';
import type { LLMProvider, Chunk } from '@ragsdk/core';

const makeChunk = (id: string, content: string): Chunk => ({
  id,
  documentId: 'doc-1',
  content,
  metadata: {},
});

describe('SelfRAGGenerator', () => {
  it('should generate answer with reflection tokens', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('TypeScript is a language.'),
      chatStream: vi.fn(),
      chatJson: vi.fn()
        .mockResolvedValueOnce({ needsRetrieval: false, reason: '已有上下文' })
        .mockResolvedValueOnce({ answerFaithful: true, reason: '答案忠实' }),
    };

    const generator = new SelfRAGGenerator(llm);
    const result = await generator.generate('What is TypeScript?', [
      makeChunk('c1', 'TypeScript is a programming language.'),
    ]);

    expect(result.answer).toBe('TypeScript is a language.');
    expect(result.reflection).toBeDefined();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty chunks', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('no info'),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockRejectedValue(new Error('skip')),
    };

    const generator = new SelfRAGGenerator(llm);
    const result = await generator.generate('test', []);

    expect(result.answer).toBeDefined();
  });

  it('should fallback when chatJson fails', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('Fallback answer.'),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockRejectedValue(new Error('not supported')),
    };

    const generator = new SelfRAGGenerator(llm);
    const result = await generator.generate('test', [makeChunk('c1', 'context')]);

    expect(result.answer).toBe('Fallback answer.');
    expect(result.regenerated).toBe(false);
  });
});
