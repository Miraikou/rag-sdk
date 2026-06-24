import { describe, it, expect } from 'vitest';
import { ROUGEEvaluator } from '../../src/generation/rouge';

describe('ROUGEEvaluator', () => {
  describe('ROUGE-L（默认）', () => {
    it('完全相同文本得分为 1', () => {
      const evaluator = new ROUGEEvaluator();
      const result = evaluator.evaluate('今天天气很好', '今天天气很好');

      expect(result.name).toBe('ROUGE-L');
      expect(result.score).toBeCloseTo(1);
    });

    it('部分重叠文本得分在 0-1 之间', () => {
      const evaluator = new ROUGEEvaluator();
      const result = evaluator.evaluate('今天天气很好', '今天天气非常好');

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(1);
    });

    it('完全不同文本得分为 0', () => {
      const evaluator = new ROUGEEvaluator();
      // 使用完全无重叠的单字中文 token
      const result = evaluator.evaluate('甲 乙 丙', '天 地 人');

      expect(result.score).toBe(0);
    });
  });

  describe('ROUGE-1（unigram）', () => {
    it('完全相同文本得分为 1', () => {
      const evaluator = new ROUGEEvaluator({ variant: '1' });
      const result = evaluator.evaluate('今天 天气 很好', '今天 天气 很好');

      expect(result.name).toBe('ROUGE-1');
      expect(result.score).toBeCloseTo(1);
    });

    it('部分重叠时计算 F1', () => {
      const evaluator = new ROUGEEvaluator({ variant: '1' });
      const result = evaluator.evaluate('今天 天气 很好 晴天', '今天 天气 很好 多云');

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(1);
    });
  });

  describe('ROUGE-2（bigram）', () => {
    it('完全相同文本得分为 1', () => {
      const evaluator = new ROUGEEvaluator({ variant: '2' });
      const result = evaluator.evaluate('今天 天气 很好', '今天 天气 很好');

      expect(result.name).toBe('ROUGE-2');
      expect(result.score).toBeCloseTo(1);
    });
  });

  it('空文本得分为 0', () => {
    const evaluator = new ROUGEEvaluator();
    const result = evaluator.evaluate('', '今天天气很好');

    expect(result.score).toBe(0);
  });

  it('details 包含 precision、recall、f1', () => {
    const evaluator = new ROUGEEvaluator();
    const result = evaluator.evaluate('今天天气很好', '今天天气非常好');

    expect(result.details).toBeDefined();
    expect(typeof result.details!.precision).toBe('number');
    expect(typeof result.details!.recall).toBe('number');
    expect(typeof result.details!.f1).toBe('number');
  });
});
