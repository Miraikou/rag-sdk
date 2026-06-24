import { describe, it, expect } from 'vitest';

describe('PineconeStore', () => {
  it('should export PineconeStore', async () => {
    const { PineconeStore } = await import('../../storage-pinecone/src/index');
    expect(PineconeStore).toBeDefined();
  });

  it('should create instance with config', async () => {
    const { PineconeStore } = await import('../../storage-pinecone/src/index');
    const store = new PineconeStore({
      apiKey: 'test-key',
      baseUrl: 'https://my-index.svc.pinecone.io',
      namespace: 'test-ns',
    });
    expect(store).toBeDefined();
  });

  it('should implement VectorStore methods', async () => {
    const { PineconeStore } = await import('../../storage-pinecone/src/index');
    const store = new PineconeStore({
      apiKey: 'test-key',
      baseUrl: 'https://my-index.svc.pinecone.io',
    });
    expect(typeof store.upsert).toBe('function');
    expect(typeof store.upsertByDocument).toBe('function');
    expect(typeof store.search).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.deleteByDocument).toBe('function');
  });
});
