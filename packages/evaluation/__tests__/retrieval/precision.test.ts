import { describe, it, expect } from 'vitest';
import { PrecisionEvaluator } from '../../src/retrieval/precision';
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

describe('PrecisionEvaluator', () => {
  it('计算基本精确率', () => {
    const evaluator = new PrecisionEvaluator({ k: 5 });
    const results = [
      mockResult('a'),
      mockResult('b'),
      mockResult('c'),
      mockResult('d'),
      mockResult('e'),
    ];
    const groundTruth = ['a', 'c', 'f'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.name).toBe('Precision@K');
    // top5 中 a 和 c 相关 → 2/5
    expect(result.score).toBeCloseTo(2 / 5);
  });

  it('全部精确时得分为 1', () => {
    const evaluator = new PrecisionEvaluator({ k: 3 });
    const results = [mockResult('a'), mockResult('b'), mockResult('c')];
    const groundTruth = ['a', 'b', 'c'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBe(1);
  });

  it('无精确时得分为 0', () => {
    const evaluator = new PrecisionEvaluator({ k: 3 });
    const results = [mockResult('d'), mockResult('e'), mockResult('f')];
    const groundTruth = ['a', 'b'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBe(0);
  });

  it('k=0 时返回 0', () => {
    const evaluator = new PrecisionEvaluator({ k: 0 });
    const result = evaluator.evaluate([mockResult('a')], ['a']);

    expect(result.score).toBe(0);
  });

  it('默认 k 值为 10', () => {
    const evaluator = new PrecisionEvaluator();
    const results = Array.from({ length: 10 }, (_, i) => mockResult(`r${i}`));
    const groundTruth = ['r0', 'r5'];

    const result = evaluator.evaluate(results, groundTruth);

    // 2 个相关 / 10 → 0.2
    expect(result.score).toBeCloseTo(0.2);
  });
});
