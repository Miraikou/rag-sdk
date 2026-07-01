import type { Chunk, SearchOptions, SearchResult, VectorStore } from '@ragsdk/core';

/**
 * 向量存储抽象基类
 * 提供默认的空实现，子类按需覆盖
 */
export abstract class BaseVectorStore implements VectorStore {
  async upsert(_chunks: Chunk[]): Promise<void> {
    throw new Error('upsert() 未实现，请在子类中覆盖');
  }

  async upsertByDocument(_documentId: string, _chunks: Chunk[]): Promise<void> {
    throw new Error('upsertByDocument() 未实现，请在子类中覆盖');
  }

  async search(_query: number[], _options?: SearchOptions): Promise<SearchResult[]> {
    throw new Error('search() 未实现，请在子类中覆盖');
  }

  async delete(_ids: string[]): Promise<void> {
    throw new Error('delete() 未实现，请在子类中覆盖');
  }

  async deleteByDocument(_documentId: string): Promise<void> {
    throw new Error('deleteByDocument() 未实现，请在子类中覆盖');
  }
}
