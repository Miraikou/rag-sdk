import { describe, it, expect } from 'vitest';

describe('Voyage', () => {
  it('should export VoyageEmbeddingProvider', async () => {
    const { VoyageEmbeddingProvider } = await import('../../embedding-voyage/src/index');
    expect(VoyageEmbeddingProvider).toBeDefined();
    expect(typeof VoyageEmbeddingProvider).toBe('function');
  });

  it('should create instance with config', async () => {
    const { VoyageEmbeddingProvider } = await import('../../embedding-voyage/src/index');
    const provider = new VoyageEmbeddingProvider({
      apiKey: 'test-key',
      model: 'voyage-3',
      dimension: 1024,
    });
    expect(provider).toBeDefined();
    expect(provider.dimension).toBe(1024);
  });

  it('should have correct default dimension', async () => {
    const { VoyageEmbeddingProvider } = await import('../../embedding-voyage/src/index');
    const provider = new VoyageEmbeddingProvider({ apiKey: 'test-key' });
    expect(provider.dimension).toBe(1024);
  });

  it('should have embed method', async () => {
    const { VoyageEmbeddingProvider } = await import('../../embedding-voyage/src/index');
    const provider = new VoyageEmbeddingProvider({ apiKey: 'test-key' });
    expect(typeof provider.embed).toBe('function');
    expect(typeof provider.embedBatch).toBe('function');
  });
});
