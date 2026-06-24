import { describe, it, expect } from 'vitest';
import { MRREvaluator } from '../../src/retrieval/mrr';
import type { SearchResult } from '@rag-sdk/core';

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

describe('MRREvaluator', () => {
  it('第一个结果即相关时得分为 1', () => {
    const evaluator = new MRREvaluator();
    const results = [mockResult('a'), mockResult('b'), mockResult('c')];
    const groundTruth = ['a'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.name).toBe('MRR');
    expect(result.score).toBe(1);
  });

  it('第二个结果相关时得分为 0.5', () => {
    const evaluator = new MRREvaluator();
    const results = [mockResult('x'), mockResult('a'), mockResult('b')];
    const groundTruth = ['a'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBe(0.5);
  });

  it('第三个结果相关时得分为 1/3', () => {
    const evaluator = new MRREvaluator();
    const results = [mockResult('x'), mockResult('y'), mockResult('a')];
    const groundTruth = ['a'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBeCloseTo(1 / 3);
  });

  it('无相关结果时得分为 0', () => {
    const evaluator = new MRREvaluator();
    const results = [mockResult('x'), mockResult('y')];
    const groundTruth = ['a'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBe(0);
  });

  it('多个相关时取排名最靠前的', () => {
    const evaluator = new MRREvaluator();
    const results = [mockResult('x'), mockResult('b'), mockResult('a')];
    const groundTruth = ['a', 'b'];

    const result = evaluator.evaluate(results, groundTruth);

    // b 在第 2 位 → MRR = 1/2
    expect(result.score).toBe(0.5);
  });

  it('空结果列表时得分为 0', () => {
    const evaluator = new MRREvaluator();
    const result = evaluator.evaluate([], ['a']);

    expect(result.score).toBe(0);
  });
});
