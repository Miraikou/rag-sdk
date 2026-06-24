import { describe, it, expect } from 'vitest';

describe('WeaviateStore', () => {
  it('should export WeaviateStore', async () => {
    const { WeaviateStore } = await import('../../storage-weaviate/src/index');
    expect(WeaviateStore).toBeDefined();
  });

  it('should create instance with config', async () => {
    const { WeaviateStore } = await import('../../storage-weaviate/src/index');
    const store = new WeaviateStore({
      baseUrl: 'http://localhost:8080',
      apiKey: 'test-key',
      className: 'TestChunk',
    });
    expect(store).toBeDefined();
  });

  it('should implement VectorStore methods', async () => {
    const { WeaviateStore } = await import('../../storage-weaviate/src/index');
    const store = new WeaviateStore({ baseUrl: 'http://localhost:8080' });
    expect(typeof store.upsert).toBe('function');
    expect(typeof store.upsertByDocument).toBe('function');
    expect(typeof store.search).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.deleteByDocument).toBe('function');
  });
});
