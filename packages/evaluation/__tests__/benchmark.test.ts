import { describe, it, expect, vi } from 'vitest';
import { BenchmarkRunner } from '../src/benchmark';
import type {
  GenerationEvaluator,
  MetricResult,
  Retriever,
  RetrievalEvaluator,
  SearchResult,
} from '@rag-sdk/core';

/** 构建 mock SearchResult */
function mockResult(id: string): SearchResult {
  return {
    chunk: { id, documentId: `doc-${id}`, content: '', metadata: {} },
    score: 0.9,
    source: 'vector',
  };
}

/** 构建 mock Retriever */
function createMockRetriever(results: SearchResult[]): Retriever {
  return {
    retrieve: vi.fn(async () => results),
  };
}

/** 构建 mock RetrievalEvaluator */
function createMockRetrievalEvaluator(name: string, score: number): RetrievalEvaluator {
  return {
    evaluate: vi.fn(() => ({ name, score })),
  };
}

/** 构建 mock GenerationEvaluator */
function createMockGenerationEvaluator(name: string, score: number): GenerationEvaluator {
  return {
    evaluate: vi.fn(async () => ({ name, score })),
  };
}

describe('BenchmarkRunner', () => {
  describe('runRetrievalBenchmark', () => {
    it('对多个样本执行检索评测', async () => {
      const runner = new BenchmarkRunner({ concurrency: 2 });
      const retriever = createMockRetriever([mockResult('a')]);
      const evaluator = createMockRetrievalEvaluator('Recall@K', 0.8);
      const dataset = [
        { query: '查询1', relevantIds: ['a'] },
        { query: '查询2', relevantIds: ['b'] },
        { query: '查询3', relevantIds: ['c'] },
      ];

      const report = await runner.runRetrievalBenchmark([evaluator], retriever, dataset);

      expect(report.totalSamples).toBe(3);
      expect(report.metrics['Recall@K']).toBeDefined();
      expect(report.metrics['Recall@K'].mean).toBeCloseTo(0.8);
      expect(report.perSample.length).toBe(3);
    });

    it('支持多个检索评测器', async () => {
      const runner = new BenchmarkRunner();
      const retriever = createMockRetriever([mockResult('a')]);
      const evaluators = [
        createMockRetrievalEvaluator('Recall@K', 0.8),
        createMockRetrievalEvaluator('Precision@K', 0.6),
      ];
      const dataset = [{ query: '查询', relevantIds: ['a'] }];

      const report = await runner.runRetrievalBenchmark(evaluators, retriever, dataset);

      expect(report.evaluators).toContain('Recall@K');
      expect(report.evaluators).toContain('Precision@K');
    });

    it('统计 mean/std/min/max', async () => {
      const runner = new BenchmarkRunner();
      const retriever = createMockRetriever([mockResult('a')]);

      let callCount = 0;
      const evaluator: RetrievalEvaluator = {
        evaluate: () => {
          callCount++;
          return { name: 'Score', score: callCount * 0.2 };
        },
      };

      const dataset = [
        { query: 'q1', relevantIds: ['a'] },
        { query: 'q2', relevantIds: ['a'] },
        { query: 'q3', relevantIds: ['a'] },
      ];

      const report = await runner.runRetrievalBenchmark([evaluator], retriever, dataset);

      // 分数：0.2, 0.4, 0.6
      expect(report.metrics['Score'].min).toBeCloseTo(0.2);
      expect(report.metrics['Score'].max).toBeCloseTo(0.6);
      expect(report.metrics['Score'].mean).toBeCloseTo(0.4);
      expect(report.metrics['Score'].std).toBeGreaterThan(0);
    });
  });

  describe('runGenerationBenchmark', () => {
    it('对多个样本执行生成评测', async () => {
      const runner = new BenchmarkRunner({ concurrency: 2 });
      const evaluator = createMockGenerationEvaluator('BLEU', 0.5);
      const dataset = [
        { query: 'q1', answer: '回答1', reference: '参考1' },
        { query: 'q2', answer: '回答2', reference: '参考2' },
      ];

      const report = await runner.runGenerationBenchmark([evaluator], dataset);

      expect(report.totalSamples).toBe(2);
      expect(report.metrics['BLEU']).toBeDefined();
      expect(report.metrics['BLEU'].mean).toBeCloseTo(0.5);
    });

    it('传递上下文到评测器', async () => {
      const runner = new BenchmarkRunner();
      const evaluateFn = vi.fn(async () => ({ name: 'Test', score: 0.5 }));
      const evaluator: GenerationEvaluator = { evaluate: evaluateFn };

      const dataset = [
        { query: 'q1', answer: '回答', reference: '参考', contexts: ['ctx1', 'ctx2'] },
      ];

      await runner.runGenerationBenchmark([evaluator], dataset);

      // contexts 被 join 后传递给 context 参数
      expect(evaluateFn).toHaveBeenCalledWith('回答', '参考', 'ctx1\n---\nctx2');
    });
  });
});
