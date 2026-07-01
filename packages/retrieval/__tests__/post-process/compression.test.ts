import { describe, it, expect, vi } from 'vitest';
import { CompressionPostProcessor } from '../../src/post-process/compression';
import type { LLMProvider, SearchResult } from '@ragsdk/core';

function createMockLLM(response: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue(response),
    chatStream: vi.fn(),
  };
}

const makeResult = (id: string, content: string, score: number = 0.8): SearchResult => ({
  chunk: { id, documentId: 'd1', content, metadata: {} },
  score,
  source: 'vector',
});

describe('CompressionPostProcessor', () => {
  it('should compress chunk content using LLM', async () => {
    const llm = createMockLLM('  Compressed summary about TypeScript  ');
    const processor = new CompressionPostProcessor(llm);

    const results = [makeResult('c1', 'Very long content about TypeScript and its features...')];
    const compressed = await processor.process(results, 'What is TypeScript?');

    expect(compressed).toHaveLength(1);
    expect(compressed[0]!.chunk.content).toBe('Compressed summary about TypeScript');
  });

  it('should store original and compressed lengths in metadata', async () => {
    const llm = createMockLLM('short');
    const processor = new CompressionPostProcessor(llm);

    const results = [makeResult('c1', 'a very long content that gets compressed')];
    const compressed = await processor.process(results, 'test');

    expect(compressed[0]!.chunk.metadata['originalLength']).toBe('a very long content that gets compressed'.length);
    expect(compressed[0]!.chunk.metadata['compressedLength']).toBe(5);
  });

  it('should handle empty input', async () => {
    const llm = createMockLLM('');
    const processor = new CompressionPostProcessor(llm);

    const compressed = await processor.process([], 'test');
    expect(compressed).toHaveLength(0);
  });

  it('should compress each result independently', async () => {
    const chatMock = vi.fn()
      .mockResolvedValueOnce('Summary 1')
      .mockResolvedValueOnce('Summary 2');
    const llm: LLMProvider = { chat: chatMock, chatStream: vi.fn() };

    const processor = new CompressionPostProcessor(llm);
    const results = [
      makeResult('c1', 'Content 1'),
      makeResult('c2', 'Content 2'),
    ];

    const compressed = await processor.process(results, 'query');

    expect(compressed[0]!.chunk.content).toBe('Summary 1');
    expect(compressed[1]!.chunk.content).toBe('Summary 2');
    expect(chatMock).toHaveBeenCalledTimes(2);
  });
});
