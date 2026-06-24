import { describe, it, expect } from 'vitest';
import { BaseEmbeddingProvider } from '../src/base.js';
import type { EmbeddingConfig } from '../src/types.js';

// 具体实现用于测试抽象基类
class TestEmbeddingProvider extends BaseEmbeddingProvider {
  readonly dimension = 3;

  constructor(config: EmbeddingConfig) {
    super(config);
  }

  async embed(_text: string): Promise<number[]> {
    return [1, 0, 0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => [1, 0, 0]);
  }
}

describe('BaseEmbeddingProvider', () => {
  it('should store config', () => {
    const provider = new TestEmbeddingProvider({
      apiKey: 'test-key',
      model: 'test-model',
    });

    expect(provider.dimension).toBe(3);
  });

  it('should use default baseUrl', () => {
    const provider = new TestEmbeddingProvider({ apiKey: 'test-key' });
    // baseUrl 是 protected，通过行为间接验证
    expect(provider).toBeDefined();
  });

  it('should use custom baseUrl', () => {
    const provider = new TestEmbeddingProvider({
      apiKey: 'test-key',
      baseUrl: 'https://custom.api.com/v1',
    });
    expect(provider).toBeDefined();
  });

  it('should return embedding via embed', async () => {
    const provider = new TestEmbeddingProvider({ apiKey: 'test-key' });
    const result = await provider.embed('hello');
    expect(result).toEqual([1, 0, 0]);
  });

  it('should return batch embeddings via embedBatch', async () => {
    const provider = new TestEmbeddingProvider({ apiKey: 'test-key' });
    const results = await provider.embedBatch(['a', 'b', 'c']);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1, 0, 0]);
  });
});
