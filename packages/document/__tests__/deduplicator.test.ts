import { describe, it, expect, vi } from 'vitest';
import { DocumentDeduplicator } from '../src/deduplicator';
import type { Document, EmbeddingProvider } from '@rag-sdk/core';

/** 创建测试用文档 */
function makeDoc(id: string, content: string): Document {
  return { id, content, metadata: {} };
}

/** 创建 mock EmbeddingProvider */
function createMockEmbedding(vectors: number[][]): EmbeddingProvider {
  return {
    embed: vi.fn().mockResolvedValue(vectors[0] ?? [0.1, 0.2, 0.3]),
    embedBatch: vi.fn().mockResolvedValue(vectors),
    dimension: 3,
  };
}

describe('DocumentDeduplicator', () => {
  it('should remove exact duplicate documents by hash', async () => {
    const dedup = new DocumentDeduplicator();
    const docs = [
      makeDoc('1', 'Hello world'),
      makeDoc('2', 'Hello world'),
      makeDoc('3', 'Different content'),
    ];

    const result = await dedup.deduplicate(docs);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('1');
    expect(result[1]!.id).toBe('3');
  });

  it('should treat documents with only whitespace differences as duplicates', async () => {
    const dedup = new DocumentDeduplicator();
    const docs = [
      makeDoc('1', 'Hello   world'),
      makeDoc('2', 'Hello world'),
      makeDoc('3', '  Hello world  '),
    ];

    const result = await dedup.deduplicate(docs);

    // 标准化空白后 hash 相同，只保留第一个
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('1');
  });

  it('should throw when embedding mode is used without EmbeddingProvider', () => {
    expect(() => new DocumentDeduplicator(undefined, { mode: 'embedding' })).toThrow(
      'embedding 和 both 模式需要提供 EmbeddingProvider'
    );
  });

  it('should throw when both mode is used without EmbeddingProvider', () => {
    expect(() => new DocumentDeduplicator(undefined, { mode: 'both' })).toThrow(
      'embedding 和 both 模式需要提供 EmbeddingProvider'
    );
  });

  it('should handle empty and single document arrays', async () => {
    const dedup = new DocumentDeduplicator();

    const empty = await dedup.deduplicate([]);
    expect(empty).toHaveLength(0);

    const single = await dedup.deduplicate([makeDoc('1', 'only one')]);
    expect(single).toHaveLength(1);
  });

  it('should deduplicate by embedding similarity', async () => {
    // 两个高度相似的向量 + 一个不同的向量
    const embedding = createMockEmbedding([
      [1.0, 0.0, 0.0],
      [0.99, 0.01, 0.0], // 与第一个非常相似
      [0.0, 0.0, 1.0],   // 完全不同
    ]);
    const dedup = new DocumentDeduplicator(embedding, {
      mode: 'embedding',
      similarityThreshold: 0.95,
    });

    const docs = [
      makeDoc('1', 'Longer content here to keep'),
      makeDoc('2', 'Short similar'),
      makeDoc('3', 'Totally different text'),
    ];

    const result = await dedup.deduplicate(docs);

    // doc1 和 doc2 相似度高，保留较长的 doc1；doc3 不同保留
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toContain('1');
    expect(result.map((d) => d.id)).toContain('3');
  });
});
