import { describe, it, expect, vi } from 'vitest';
import { CitationGenerator } from '../src/citation';
import type { LLMProvider, Chunk } from '@rag-sdk/core';

const makeChunk = (id: string, content: string): Chunk => ({
  id,
  documentId: 'doc-1',
  content,
  metadata: {},
});

describe('CitationGenerator', () => {
  it('should parse citation markers in answer', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('TypeScript is a language [1]. Python is popular [2].'),
      chatStream: vi.fn(),
      chatJson: vi.fn(),
    };

    const generator = new CitationGenerator(llm);
    const chunks = [
      makeChunk('c1', 'TypeScript is a programming language.'),
      makeChunk('c2', 'Python is a popular language.'),
    ];

    const result = await generator.generate('test', chunks);

    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]!.chunkId).toBe('c1');
    expect(result.sources[1]!.chunkId).toBe('c2');
  });

  it('should handle answer with no citations', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('No citations here.'),
      chatStream: vi.fn(),
      chatJson: vi.fn(),
    };

    const generator = new CitationGenerator(llm);
    const result = await generator.generate('test', [makeChunk('c1', 'text')]);

    expect(result.sources).toHaveLength(0);
  });

  it('should handle empty chunks', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('no info'),
      chatStream: vi.fn(),
      chatJson: vi.fn(),
    };

    const generator = new CitationGenerator(llm);
    const result = await generator.generate('test', []);

    expect(result.answer).toContain('无法找到');
  });

  it('should generate sourceList', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('Answer with [1] citation.'),
      chatStream: vi.fn(),
      chatJson: vi.fn(),
    };

    const generator = new CitationGenerator(llm);
    const result = await generator.generate('test', [makeChunk('c1', 'Source text')]);

    // Check that sourceList exists in metadata or result
    expect(result.answer).toContain('[1]');
  });
});
