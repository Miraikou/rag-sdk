import { describe, it, expect } from 'vitest';

describe('AnthropicEmbedding', () => {
  it('should export AnthropicEmbeddingProvider', async () => {
    const { AnthropicEmbeddingProvider } = await import('../../embedding-anthropic/src/index');
    expect(AnthropicEmbeddingProvider).toBeDefined();
  });

  it('should create instance with config', async () => {
    const { AnthropicEmbeddingProvider } = await import('../../embedding-anthropic/src/index');
    const provider = new AnthropicEmbeddingProvider({
      apiKey: 'test-key',
      model: 'text-embedding-3-small',
      dimension: 1536,
    });
    expect(provider).toBeDefined();
    expect(provider.dimension).toBe(1536);
  });

  it('should have embed and embedBatch methods', async () => {
    const { AnthropicEmbeddingProvider } = await import('../../embedding-anthropic/src/index');
    const provider = new AnthropicEmbeddingProvider({ apiKey: 'test-key' });
    expect(typeof provider.embed).toBe('function');
    expect(typeof provider.embedBatch).toBe('function');
  });
});
