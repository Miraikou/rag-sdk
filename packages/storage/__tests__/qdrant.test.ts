import { describe, it, expect } from 'vitest';

describe('QdrantStore', () => {
  it('should export QdrantStore', async () => {
    const { QdrantStore } = await import('../../storage-qdrant/src/index');
    expect(QdrantStore).toBeDefined();
  });

  it('should create instance with config', async () => {
    const { QdrantStore } = await import('../../storage-qdrant/src/index');
    const store = new QdrantStore({
      baseUrl: 'http://localhost:6333',
      apiKey: 'test-key',
      collectionName: 'test_chunks',
      dimension: 1536,
    });
    expect(store).toBeDefined();
  });

  it('should implement VectorStore methods', async () => {
    const { QdrantStore } = await import('../../storage-qdrant/src/index');
    const store = new QdrantStore({ baseUrl: 'http://localhost:6333' });
    expect(typeof store.upsert).toBe('function');
    expect(typeof store.upsertByDocument).toBe('function');
    expect(typeof store.search).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.deleteByDocument).toBe('function');
  });
});
