import { describe, it, expect } from 'vitest';
import { CharBasedTokenCounter, DefaultTokenBudgetManager } from '../src/token-budget';
import type { Chunk } from '../src/types';

/** 构建 mock Chunk */
function mockChunk(id: string, content: string): Chunk {
  return {
    id,
    documentId: `doc-${id}`,
    content,
    metadata: {},
  };
}

describe('CharBasedTokenCounter', () => {
  it('英文文本按 4 字符约 1 token 计算', () => {
    const counter = new CharBasedTokenCounter();

    // 'hello world' = 11 chars → ceil(11/4) = 3 tokens
    expect(counter.count('hello world')).toBe(3);
  });

  it('中文文本每字 1 token', () => {
    const counter = new CharBasedTokenCounter();

    // '你好世界' = 4 CJK chars → 4 tokens
    expect(counter.count('你好世界')).toBe(4);
  });

  it('中英文混合文本', () => {
    const counter = new CharBasedTokenCounter();

    // '你好 world' = 2 CJK + 6 other → 2 + ceil(6/4) = 2 + 2 = 4
    expect(counter.count('你好 world')).toBe(4);
  });

  it('空文本返回 0', () => {
    const counter = new CharBasedTokenCounter();

    expect(counter.count('')).toBe(0);
  });
});

describe('DefaultTokenBudgetManager', () => {
  it('计算可用上下文 token 数', () => {
    const budget = new DefaultTokenBudgetManager({
      maxTokens: 4096,
      systemReserved: 100,
      generationReserved: 500,
    });

    // 4096 - 100 - 500 = 3496
    expect(budget.getAvailableForContext()).toBe(3496);
  });

  it('默认生成预留为 500', () => {
    const budget = new DefaultTokenBudgetManager({ maxTokens: 2000 });

    // 2000 - 0 - 500 = 1500
    expect(budget.getAvailableForContext()).toBe(1500);
  });

  it('按预算截断上下文', () => {
    const budget = new DefaultTokenBudgetManager(
      {
        maxTokens: 10,
        generationReserved: 0,
      },
      new CharBasedTokenCounter(),
    );

    // 预算 = 10 tokens
    const chunks = [
      mockChunk('1', '你好世界'), // 4 tokens
      mockChunk('2', '你好'), // 2 tokens (6 total)
      mockChunk('3', '你好世界人'), // 5 tokens (11 > 10, 应被截断)
    ];

    const result = budget.truncateContext(chunks);

    expect(result.length).toBe(2);
    expect(result[0]!.id).toBe('1');
    expect(result[1]!.id).toBe('2');
  });

  it('预算为 0 时截断所有上下文', () => {
    const budget = new DefaultTokenBudgetManager({
      maxTokens: 100,
      systemReserved: 50,
      generationReserved: 50,
    });

    const result = budget.truncateContext([mockChunk('1', 'test')]);

    expect(result.length).toBe(0);
  });

  it('支持自定义 TokenCounter', () => {
    const customCounter = { count: () => 5 };
    const budget = new DefaultTokenBudgetManager(
      { maxTokens: 12, generationReserved: 0 },
      customCounter,
    );

    // 预算 12，每个 chunk 5 tokens → 最多 2 个
    const chunks = [mockChunk('1', 'a'), mockChunk('2', 'b'), mockChunk('3', 'c')];

    const result = budget.truncateContext(chunks);

    expect(result.length).toBe(2);
  });

  it('getUsage 返回使用统计', () => {
    const budget = new DefaultTokenBudgetManager({
      maxTokens: 4096,
      systemReserved: 100,
      generationReserved: 500,
    });

    const usage = budget.getUsage();

    expect(usage.system).toBe(100);
    expect(usage.context).toBe(3496);
    expect(usage.generation).toBe(500);
  });
});
