import { describe, it, expect } from 'vitest';

describe('GoogleEmbedding', () => {
  it('should export GoogleEmbeddingProvider', async () => {
    const { GoogleEmbeddingProvider } = await import('../../embedding-google/src/index');
    expect(GoogleEmbeddingProvider).toBeDefined();
  });

  it('should create instance with config', async () => {
    const { GoogleEmbeddingProvider } = await import('../../embedding-google/src/index');
    const provider = new GoogleEmbeddingProvider({
      apiKey: 'test-key',
      model: 'text-embedding-004',
      dimension: 768,
    });
    expect(provider).toBeDefined();
    expect(provider.dimension).toBe(768);
  });

  it('should have embed and embedBatch methods', async () => {
    const { GoogleEmbeddingProvider } = await import('../../embedding-google/src/index');
    const provider = new GoogleEmbeddingProvider({ apiKey: 'test-key' });
    expect(typeof provider.embed).toBe('function');
    expect(typeof provider.embedBatch).toBe('function');
  });
});
