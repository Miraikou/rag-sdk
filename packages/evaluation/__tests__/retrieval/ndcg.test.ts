import { describe, it, expect } from 'vitest';
import { NDCGEvaluator } from '../../src/retrieval/ndcg';
import type { SearchResult } from '@ragsdk/core';

/** 构建 mock SearchResult */
function mockResult(id: string): SearchResult {
  return {
    chunk: {
      id,
      documentId: `doc-${id}`,
      content: `content-${id}`,
      metadata: {},
    },
    score: 0.9,
    source: 'vector',
  };
}

describe('NDCGEvaluator', () => {
  it('理想排序时 NDCG 为 1', () => {
    const evaluator = new NDCGEvaluator({ k: 3 });
    // 结果按相关文档排序
    const results = [mockResult('a'), mockResult('b'), mockResult('c')];
    const groundTruth = ['a', 'b', 'c'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.name).toBe('NDCG@K');
    expect(result.score).toBeCloseTo(1);
  });

  it('非理想排序时 NDCG < 1', () => {
    const evaluator = new NDCGEvaluator({ k: 3 });
    // 相关文档 b 排在第二位
    const results = [mockResult('x'), mockResult('b'), mockResult('a')];
    const groundTruth = ['a', 'b'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBeLessThan(1);
    expect(result.score).toBeGreaterThan(0);
  });

  it('无相关结果时得分为 0', () => {
    const evaluator = new NDCGEvaluator({ k: 3 });
    const results = [mockResult('x'), mockResult('y')];
    const groundTruth = ['a', 'b'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBe(0);
  });

  it('支持分级相关性', () => {
    const evaluator = new NDCGEvaluator({ k: 3 });
    const results = [mockResult('a'), mockResult('b'), mockResult('c')];
    const groundTruth = ['a', 'b'];
    // a 高度相关（3），b 中度相关（2）
    const relevanceScores = new Map<string, number>([
      ['a', 3],
      ['b', 2],
    ]);

    const result = evaluator.evaluate(results, groundTruth, relevanceScores);

    // 理想排序（a=3, b=2）与当前排序相同 → NDCG = 1
    expect(result.score).toBeCloseTo(1);
  });

  it('分级相关性：非理想排序 NDCG < 1', () => {
    const evaluator = new NDCGEvaluator({ k: 3 });
    // b 排在 a 前面
    const results = [mockResult('b'), mockResult('a'), mockResult('c')];
    const groundTruth = ['a', 'b'];
    // a 高度相关（3），b 低度相关（1）
    const relevanceScores = new Map<string, number>([
      ['a', 3],
      ['b', 1],
    ]);

    const result = evaluator.evaluate(results, groundTruth, relevanceScores);

    // 理想排序应是 a(3) > b(1)，当前 b(1) > a(3) 不是最优
    expect(result.score).toBeLessThan(1);
    expect(result.score).toBeGreaterThan(0);
  });

  it('ground truth 为空时得分为 0', () => {
    const evaluator = new NDCGEvaluator();
    const results = [mockResult('a')];

    const result = evaluator.evaluate(results, []);

    expect(result.score).toBe(0);
  });

  it('默认 k 值为 10', () => {
    const evaluator = new NDCGEvaluator();
    const results = [mockResult('a')];
    const groundTruth = ['a'];

    const result = evaluator.evaluate(results, groundTruth);

    // k=10 但只有 1 个结果，理想排序 → NDCG = 1
    expect(result.score).toBeCloseTo(1);
  });
});
