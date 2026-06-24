import { describe, it, expect } from 'vitest';

describe('ChromaStore', () => {
  it('should export ChromaStore', async () => {
    const { ChromaStore } = await import('../../storage-chroma/src/index');
    expect(ChromaStore).toBeDefined();
  });

  it('should create instance with config', async () => {
    const { ChromaStore } = await import('../../storage-chroma/src/index');
    const store = new ChromaStore({
      baseUrl: 'http://localhost:8000',
      tenant: 'default_tenant',
      database: 'default_database',
      collectionName: 'test_chunks',
    });
    expect(store).toBeDefined();
  });

  it('should implement VectorStore methods', async () => {
    const { ChromaStore } = await import('../../storage-chroma/src/index');
    const store = new ChromaStore({ baseUrl: 'http://localhost:8000' });
    expect(typeof store.upsert).toBe('function');
    expect(typeof store.upsertByDocument).toBe('function');
    expect(typeof store.search).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.deleteByDocument).toBe('function');
  });
});
