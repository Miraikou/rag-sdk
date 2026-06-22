import { describe, it, expect } from 'vitest';
import { KeywordSearch } from '../../src/search/keyword';
import type { Chunk } from '@rag-sdk/core';

const makeChunk = (id: string, content: string): Chunk => ({
  id,
  documentId: 'd1',
  content,
  metadata: {},
});

describe('KeywordSearch', () => {
  it('should return results based on BM25 scoring', async () => {
    const chunks = [
      makeChunk('1', 'TypeScript is a programming language'),
      makeChunk('2', 'Python is a popular programming language'),
      makeChunk('3', 'The weather is nice today'),
    ];
    const search = new KeywordSearch(chunks);

    const results = await search.retrieve('TypeScript programming', { topK: 2 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2);
    // TypeScript doc should rank higher
    expect(results[0]!.chunk.id).toBe('1');
  });

  it('should return empty for no matching documents', async () => {
    const search = new KeywordSearch([
      makeChunk('1', 'TypeScript programming'),
    ]);

    const results = await search.retrieve('cooking recipe', { topK: 5 });
    expect(results).toHaveLength(0);
  });

  it('should handle empty corpus', async () => {
    const search = new KeywordSearch([]);
    const results = await search.retrieve('test query');
    expect(results).toHaveLength(0);
  });

  it('should handle empty query', async () => {
    const search = new KeywordSearch([
      makeChunk('1', 'some content'),
    ]);

    const results = await search.retrieve('');
    expect(results).toHaveLength(0);
  });

  it('should respect topK parameter', async () => {
    const chunks = [
      makeChunk('1', 'apple fruit'),
      makeChunk('2', 'apple juice'),
      makeChunk('3', 'apple pie'),
    ];
    const search = new KeywordSearch(chunks);

    const results = await search.retrieve('apple', { topK: 2 });
    expect(results).toHaveLength(2);
  });

  it('should filter results by threshold', async () => {
    const chunks = [
      makeChunk('1', 'TypeScript is a programming language developed by Microsoft'),
      makeChunk('2', 'The quick brown fox jumps'),
    ];
    const search = new KeywordSearch(chunks);

    // 设置极高的阈值，过滤掉低分结果
    const results = await search.retrieve('TypeScript programming', { threshold: 100 });
    expect(results).toHaveLength(0);
  });

  it('should handle Chinese text with Intl.Segmenter', async () => {
    const chunks = [
      makeChunk('1', 'TypeScript是一种编程语言'),
      makeChunk('2', 'Python也很流行'),
      makeChunk('3', '今天天气很好'),
    ];
    const search = new KeywordSearch(chunks);

    // 中文分词应该能正确识别 "编程" 这个词
    const results = await search.retrieve('编程语言', { topK: 2 });
    expect(results.length).toBeGreaterThan(0);
    // 第一个结果应该是包含 "编程" 的文档
    expect(results[0]!.chunk.id).toBe('1');
  });

  it('should handle mixed Chinese and English', async () => {
    const chunks = [
      makeChunk('1', '学习TypeScript编程'),
      makeChunk('2', '学习Python编程'),
      makeChunk('3', '学习做饭'),
    ];
    const search = new KeywordSearch(chunks);

    const results = await search.retrieve('TypeScript', { topK: 3 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.chunk.id).toBe('1');
  });
});
