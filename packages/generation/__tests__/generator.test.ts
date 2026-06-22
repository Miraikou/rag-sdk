import { describe, it, expect, vi } from 'vitest';
import { StandardGenerator } from '../src/generator';
import type { LLMProvider, Chunk } from '@rag-sdk/core';

const makeChunk = (id: string, content: string): Chunk => ({
  id,
  documentId: 'doc-1',
  content,
  metadata: {},
});

function createMockLLM(answer: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue(answer),
    chatStream: vi.fn(),
    chatJson: vi.fn(),
  };
}

describe('StandardGenerator', () => {
  it('should generate answer using LLM', async () => {
    const llm = createMockLLM('TypeScript is a programming language.');
    const generator = new StandardGenerator(llm);

    const result = await generator.generate('What is TypeScript?', [
      makeChunk('c1', 'TypeScript is a language'),
    ]);

    expect(result.answer).toBe('TypeScript is a programming language.');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]!.chunkId).toBe('c1');
  });

  it('should handle empty chunks', async () => {
    const llm = createMockLLM('no info');
    const generator = new StandardGenerator(llm);

    const result = await generator.generate('test', []);

    expect(result.answer).toContain('无法找到');
    expect(result.sources).toHaveLength(0);
  });

  it('should respect includeSources option', async () => {
    const llm = createMockLLM('answer');
    const generator = new StandardGenerator(llm);

    const result = await generator.generate('test', [makeChunk('c1', 'text')], {
      includeSources: false,
    });

    expect(result.sources).toHaveLength(0);
  });

  it('should pass maxTokens to LLM', async () => {
    const llm = createMockLLM('answer');
    const generator = new StandardGenerator(llm);

    await generator.generate('test', [makeChunk('c1', 'text')], { maxTokens: 100 });

    const chatCall = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(chatCall[1].maxTokens).toBe(100);
  });
});
