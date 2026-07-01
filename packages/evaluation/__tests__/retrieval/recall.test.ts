import { describe, it, expect } from 'vitest';
import { RecallEvaluator } from '../../src/retrieval/recall';
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

describe('RecallEvaluator', () => {
  it('计算基本召回率', () => {
    const evaluator = new RecallEvaluator({ k: 5 });
    const results = [mockResult('a'), mockResult('b'), mockResult('c')];
    const groundTruth = ['a', 'b', 'd'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.name).toBe('Recall@K');
    // a 和 b 被检索到，d 未检索到 → 2/3
    expect(result.score).toBeCloseTo(2 / 3);
  });

  it('全部召回时得分为 1', () => {
    const evaluator = new RecallEvaluator({ k: 5 });
    const results = [mockResult('a'), mockResult('b')];
    const groundTruth = ['a', 'b'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBe(1);
  });

  it('无召回时得分为 0', () => {
    const evaluator = new RecallEvaluator({ k: 5 });
    const results = [mockResult('c'), mockResult('d')];
    const groundTruth = ['a', 'b'];

    const result = evaluator.evaluate(results, groundTruth);

    expect(result.score).toBe(0);
  });

  it('ground truth 为空时返回 0', () => {
    const evaluator = new RecallEvaluator();
    const results = [mockResult('a')];

    const result = evaluator.evaluate(results, []);

    expect(result.score).toBe(0);
    expect(result.reason).toBe('无标注数据');
  });

  it('k 值限制只取前 k 个结果', () => {
    const evaluator = new RecallEvaluator({ k: 2 });
    const results = [mockResult('c'), mockResult('d'), mockResult('a')];
    const groundTruth = ['a'];

    const result = evaluator.evaluate(results, groundTruth);

    // k=2 只取前 2 个（c, d），a 不在其中
    expect(result.score).toBe(0);
  });

  it('默认 k 值为 10', () => {
    const evaluator = new RecallEvaluator();
    const results = Array.from({ length: 15 }, (_, i) => mockResult(`r${i}`));
    const groundTruth = ['r0', 'r12'];

    const result = evaluator.evaluate(results, groundTruth);

    // k=10 只取前 10 个，r12 不在其中 → 1/2
    expect(result.score).toBeCloseTo(0.5);
  });
});
