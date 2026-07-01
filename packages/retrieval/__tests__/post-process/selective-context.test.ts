import { describe, it, expect, vi } from 'vitest';
import { SelectiveContextPostProcessor } from '../../src/post-process/selective-context';
import type { LLMProvider, SearchResult } from '@ragsdk/core';

const makeResult = (id: string, content: string): SearchResult => ({
  chunk: { id, documentId: 'doc-1', content, metadata: {} },
  score: 0.9,
  source: 'vector',
});

/** 创建 mock LLM：chatJson 返回结构化数据 */
function createMockLLMStructured(result: { relevantIndices: number[] }): LLMProvider {
  return {
    chat: vi.fn(),
    chatStream: vi.fn(),
    chatJson: vi.fn().mockResolvedValue(result),
  };
}

/** 创建 mock LLM：chatJson 抛异常（测试降级路径） */
function createMockLLMFallback(chatResponse: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue(chatResponse),
    chatStream: vi.fn(),
    chatJson: vi.fn().mockRejectedValue(new Error('chatJson not supported')),
  };
}

describe('SelectiveContextPostProcessor', () => {
  // === chatJson 结构化输出路径 ===

  it('should use chatJson to filter relevant sentences', async () => {
    const llm = createMockLLMStructured({ relevantIndices: [1, 3] });
    const processor = new SelectiveContextPostProcessor(llm);

    const results = [makeResult('c1', '第一句话。第二句话。第三句话。')];
    const processed = await processor.process(results, 'test query');

    expect(processed).toHaveLength(1);
    expect(processed[0]!.chunk.content).toContain('第一句话');
    expect(processed[0]!.chunk.content).toContain('第三句话');
    expect(processed[0]!.chunk.content).not.toContain('第二句话');
  });

  it('should discard chunk when all sentences are irrelevant', async () => {
    const llm = createMockLLMStructured({ relevantIndices: [] });
    const processor = new SelectiveContextPostProcessor(llm);

    const results = [makeResult('c1', '不相关一。不相关二。不相关三。')];
    const processed = await processor.process(results, 'test query');

    expect(processed).toHaveLength(0);
  });

  // === 降级路径（chatJson 抛异常） ===

  it('should fallback to regex parsing when chatJson fails', async () => {
    const llm = createMockLLMFallback('1\n3');
    const processor = new SelectiveContextPostProcessor(llm);

    const results = [makeResult('c1', '第一句话。第二句话。第三句话。')];
    const processed = await processor.process(results, 'test query');

    expect(processed).toHaveLength(1);
    expect(processed[0]!.chunk.content).toContain('第一句话');
    expect(processed[0]!.chunk.content).toContain('第三句话');
  });

  it('should handle NONE response in fallback mode', async () => {
    const llm = createMockLLMFallback('NONE');
    const processor = new SelectiveContextPostProcessor(llm);

    const results = [makeResult('c1', '不相关一。不相关二。')];
    const processed = await processor.process(results, 'test query');

    expect(processed).toHaveLength(0);
  });

  // === 边界情况 ===

  it('should skip single-sentence chunks', async () => {
    const llm = createMockLLMStructured({ relevantIndices: [] });
    const processor = new SelectiveContextPostProcessor(llm);

    const results = [makeResult('c1', '只有一句话')];
    const processed = await processor.process(results, 'test query');

    expect(processed).toHaveLength(1);
    expect(processed[0]!.chunk.content).toBe('只有一句话');
  });

  it('should handle empty input', async () => {
    const llm = createMockLLMStructured({ relevantIndices: [] });
    const processor = new SelectiveContextPostProcessor(llm);

    const processed = await processor.process([], 'test');
    expect(processed).toHaveLength(0);
  });
});
