import { describe, it, expect } from 'vitest';
import { BaseVectorStore } from '../src/base';

describe('BaseVectorStore', () => {
  it('should throw on upsert if not implemented', async () => {
    const store = new (class extends BaseVectorStore {})();
    await expect(store.upsert([])).rejects.toThrow('upsert() 未实现');
  });

  it('should throw on upsertByDocument if not implemented', async () => {
    const store = new (class extends BaseVectorStore {})();
    await expect(store.upsertByDocument('doc1', [])).rejects.toThrow('upsertByDocument() 未实现');
  });

  it('should throw on search if not implemented', async () => {
    const store = new (class extends BaseVectorStore {})();
    await expect(store.search([1, 0, 0])).rejects.toThrow('search() 未实现');
  });

  it('should throw on delete if not implemented', async () => {
    const store = new (class extends BaseVectorStore {})();
    await expect(store.delete(['id1'])).rejects.toThrow('delete() 未实现');
  });

  it('should throw on deleteByDocument if not implemented', async () => {
    const store = new (class extends BaseVectorStore {})();
    await expect(store.deleteByDocument('doc1')).rejects.toThrow('deleteByDocument() 未实现');
  });

  it('should allow subclass to override methods', async () => {
    const store = new (class extends BaseVectorStore {
      async search(_query: number[]): Promise<[]> {
        return [];
      }
    })();
    const results = await store.search([1, 0]);
    expect(results).toEqual([]);
  });
});
