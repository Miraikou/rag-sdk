import { describe, it, expect, vi } from 'vitest';
import { ConsistencyChecker } from '../src/consistency';
import type { Chunk, Generator, LLMProvider } from '@rag-sdk/core';

const makeChunk = (id: string, content: string): Chunk => ({
  id,
  documentId: 'doc-1',
  content,
  metadata: {},
});

describe('ConsistencyChecker', () => {
  it('should detect high consistency when answers are identical', async () => {
    const generator: Generator = {
      generate: vi.fn().mockResolvedValue({
        answer: 'TypeScript is a language.',
        sources: [],
        metadata: {},
      }),
    };

    const checker = new ConsistencyChecker(generator, { rounds: 3 });
    const result = await checker.check('What is TypeScript?', [makeChunk('c1', 'text')]);

    expect(result.answers).toHaveLength(3);
    expect(result.consistencyScore).toBe(1);
    expect(result.bestAnswer).toBe('TypeScript is a language.');
    expect(result.conflicts).toHaveLength(0);
  });

  it('should detect low consistency when answers differ', async () => {
    const answers = ['Answer A', 'Answer B', 'Answer C'];
    let callCount = 0;
    const generator: Generator = {
      generate: vi.fn().mockImplementation(() => {
        const answer = answers[callCount] ?? 'unknown';
        callCount++;
        return Promise.resolve({ answer, sources: [], metadata: {} });
      }),
    };

    const checker = new ConsistencyChecker(generator, { rounds: 3 });
    const result = await checker.check('test', [makeChunk('c1', 'text')]);

    expect(result.answers).toHaveLength(3);
    expect(result.consistencyScore).toBeLessThan(1);
  });

  it('should use LLM for analysis when provided', async () => {
    const generator: Generator = {
      generate: vi.fn().mockResolvedValue({
        answer: 'Same answer',
        sources: [],
        metadata: {},
      }),
    };

    const llm: LLMProvider = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockResolvedValue({
        consistencyScore: 0.9,
        bestAnswer: 'Same answer',
        conflicts: [],
      }),
    };

    const checker = new ConsistencyChecker(generator, { rounds: 2, llm });
    const result = await checker.check('test', [makeChunk('c1', 'text')]);

    expect(result.consistencyScore).toBe(0.9);
  });

  it('should handle empty chunks', async () => {
    const generator: Generator = {
      generate: vi.fn().mockResolvedValue({
        answer: 'No info',
        sources: [],
        metadata: {},
      }),
    };

    const checker = new ConsistencyChecker(generator, { rounds: 2 });
    const result = await checker.check('test', []);

    expect(result.answers).toHaveLength(2);
  });
});
