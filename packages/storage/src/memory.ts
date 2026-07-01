import type { Chunk, SearchOptions, SearchResult, VectorStore } from '@ragsdk/core';

/**
 * 计算两个向量的余弦相似度
 * 要求 a 和 b 长度相同
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}

/**
 * 内存向量存储
 * 零依赖实现，使用 Map 存储 Chunk，暴力余弦相似度搜索
 * 适用于开发、测试和小规模数据集
 */
export class MemoryStore implements VectorStore {
  private chunks = new Map<string, Chunk>();
  private dimension: number | null = null;

  /** 插入或更新 chunks */
  async upsert(chunks: Chunk[]): Promise<void> {
    for (const chunk of chunks) {
      if (chunk.embedding) {
        if (this.dimension === null) {
          this.dimension = chunk.embedding.length;
        } else if (chunk.embedding.length !== this.dimension) {
          throw new Error(
            `Embedding dimension mismatch: expected ${this.dimension}, got ${chunk.embedding.length} (chunk: ${chunk.id})`
          );
        }
      }
      this.chunks.set(chunk.id, chunk);
    }
  }

  /** 按文档 ID 替换所有 chunks（先删后插） */
  async upsertByDocument(documentId: string, chunks: Chunk[]): Promise<void> {
    await this.deleteByDocument(documentId);
    await this.upsert(chunks);
  }

  /** 余弦相似度搜索 */
  async search(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0;

    const scored: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) continue;

      // metadata 过滤：所有 filter 键值必须完全匹配
      if (options?.filter) {
        const matchesFilter = Object.entries(options.filter).every(
          ([key, value]) => chunk.metadata[key] === value,
        );
        if (!matchesFilter) continue;
      }

      const score = cosineSimilarity(query, chunk.embedding);
      if (score >= threshold) {
        scored.push({ chunk, score, source: 'vector' });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /** 按 ID 删除 chunks */
  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.chunks.delete(id);
    }
  }

  /** 按文档 ID 删除所有关联 chunks */
  async deleteByDocument(documentId: string): Promise<void> {
    for (const [id, chunk] of this.chunks) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(id);
      }
    }
  }
}
