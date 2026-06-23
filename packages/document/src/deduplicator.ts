import { createHash } from 'crypto';
import type { Document, EmbeddingProvider, DeduplicatorOptions } from './types';

/**
 * 文档去重器
 *
 * 去除重复或高度相似的文档，避免冗余数据污染索引。
 * 支持两种去重模式：
 * - **hash**：基于内容 SHA-256 的精确去重（速度快、零误判）
 * - **embedding**：基于向量相似度的模糊去重（能捕获语义相同的文档）
 * - **both**：先 hash 去重，再 embedding 去重
 */
export class DocumentDeduplicator {
  private readonly embeddingProvider: EmbeddingProvider | null;
  private readonly mode: 'hash' | 'embedding' | 'both';
  private readonly similarityThreshold: number;

  /**
   * @param embeddingProvider - 向量嵌入提供商（embedding/both 模式必需）
   * @param options - 去重选项
   * @param options.mode - 去重模式，默认 'hash'
   * @param options.similarityThreshold - Embedding 相似度阈值，默认 0.95
   */
  constructor(
    embeddingProvider?: EmbeddingProvider,
    options?: DeduplicatorOptions
  ) {
    this.embeddingProvider = embeddingProvider ?? null;
    this.mode = options?.mode ?? 'hash';
    this.similarityThreshold = options?.similarityThreshold ?? 0.95;

    if ((this.mode === 'embedding' || this.mode === 'both') && !this.embeddingProvider) {
      throw new Error('embedding 和 both 模式需要提供 EmbeddingProvider');
    }
  }

  /**
   * 去重文档列表
   *
   * @param documents - 待去重的文档数组
   * @returns 去重后的文档数组
   */
  async deduplicate(documents: Document[]): Promise<Document[]> {
    let result = documents;

    if (this.mode === 'hash' || this.mode === 'both') {
      result = this.deduplicateByHash(result);
    }

    if (this.mode === 'embedding' || this.mode === 'both') {
      result = await this.deduplicateByEmbedding(result);
    }

    return result;
  }

  /**
   * 基于内容 Hash 的精确去重
   *
   * 将文档内容标准化（去除多余空白）后计算 SHA-256，相同 Hash 的文档只保留第一个。
   */
  private deduplicateByHash(documents: Document[]): Document[] {
    const seen = new Map<string, Document>();

    for (const doc of documents) {
      const hash = this.computeHash(doc.content);
      if (!seen.has(hash)) {
        seen.set(hash, doc);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * 基于 Embedding 相似度的模糊去重
   *
   * 计算文档的向量表示，相似度超过阈值的文档只保留较长的那个。
   */
  private async deduplicateByEmbedding(documents: Document[]): Promise<Document[]> {
    if (documents.length <= 1 || !this.embeddingProvider) return documents;

    // 批量计算 Embedding（截断过长文本避免超 token 限制）
    const embeddings = await this.embeddingProvider.embedBatch(
      documents.map((d) => d.content.slice(0, 2000))
    );

    const keep: boolean[] = new Array(documents.length).fill(true);

    for (let i = 0; i < documents.length; i++) {
      if (!keep[i]) continue;

      for (let j = i + 1; j < documents.length; j++) {
        if (!keep[j]) continue;

        const similarity = this.cosineSimilarity(embeddings[i]!, embeddings[j]!);
        if (similarity >= this.similarityThreshold) {
          // 保留较长的那个
          if (documents[i]!.content.length >= documents[j]!.content.length) {
            keep[j] = false;
          } else {
            keep[i] = false;
            break;
          }
        }
      }
    }

    return documents.filter((_, i) => keep[i]);
  }

  /**
   * 计算文本的内容 Hash
   *
   * 标准化空白后计算 SHA-256，确保仅空格差异的文档也能被检测到。
   */
  private computeHash(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * 计算两个向量的余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
