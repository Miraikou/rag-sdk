import type { Chunk, ChunkOptions, Document, EmbeddingProvider } from '@ragsdk/core';
import { BaseChunker } from './base';

/**
 * 语义切块器
 *
 * 根据相邻句子的语义相似度决定切分点。
 * 相似度低于阈值处断开，保证每个 chunk 在语义上自洽。
 *
 * 依赖 EmbeddingProvider 计算句子向量。
 */
export class SemanticChunker extends BaseChunker {
  private embedding: EmbeddingProvider;
  private similarityThreshold: number;
  private minChunkSize: number;
  private maxChunkSize: number;

  /**
   * @param options - 语义切块配置
   * @param options.embedding - 向量嵌入提供商，用于计算句子向量
   * @param options.chunkSize - 参考块大小，默认 500
   * @param options.similarityThreshold - 语义相似度阈值，低于此值处断开，默认 0.5
   * @param options.minChunkSize - 最小块大小，低于此值会与相邻组合并，默认 50
   * @param options.maxChunkSize - 最大块大小，超过此值会强制拆分，默认 1000
   */
  constructor(options: {
    embedding: EmbeddingProvider;
    chunkSize?: number;
    similarityThreshold?: number;
    minChunkSize?: number;
    maxChunkSize?: number;
  }) {
    super({ chunkSize: options.chunkSize ?? 500 });
    this.embedding = options.embedding;
    this.similarityThreshold = options.similarityThreshold ?? 0.5;
    this.minChunkSize = options.minChunkSize ?? 50;
    this.maxChunkSize = options.maxChunkSize ?? 1000;
  }

  /**
   * 同步切块（降级方案，基于长度切分句子组）
   *
   * 同步版本无法调用 Embedding API，使用基于长度的切分作为降级。
   * 如需语义切分，请使用 chunkAsync 方法。
   *
   * @param document - 待切分的文档
   * @returns 切分后的 chunk 数组
   */
  chunk(document: Document, options?: ChunkOptions): Chunk[] {
    const content = document.content;
    if (!content.trim()) return [];

    // 1. 拆分句子
    const sentences = this.splitSentences(content);
    if (sentences.length === 0) return [];

    // 单句超过 maxChunkSize 时，按字符强制切分
    if (sentences.length === 1) {
      const text = (sentences[0] ?? '').trim();
      if (text.length <= this.maxChunkSize) {
        return [{
          id: this.generateChunkId(document.id, 0),
          documentId: document.id,
          content: text,
          metadata: { ...document.metadata, chunkIndex: 0 },
        }];
      }
      return this.splitOversizedText(document, text);
    }

    // 2. 同步返回（SemanticChunker 的 chunk 方法签名是同步的）
    // 实际的语义切分需要异步调用 embedding，这里先用简单的同步降级方案
    // 返回基于长度的切分结果
    return this.fallbackChunk(document, sentences);
  }

  /**
   * 异步语义切分（推荐使用此方法）
   *
   * 计算相邻句子的 Embedding 相似度，低于阈值处断开，
   * 并自动合并过小的组、拆分过大的组。
   *
   * @param document - 待切分的文档
   * @returns 语义切分后的 chunk 数组
   */
  async chunkAsync(document: Document): Promise<Chunk[]> {
    const content = document.content;
    if (!content.trim()) return [];

    const sentences = this.splitSentences(content);
    if (sentences.length === 0) return [];

    // 单句超过 maxChunkSize 时，按字符强制切分
    if (sentences.length === 1) {
      const text = (sentences[0] ?? '').trim();
      if (text.length <= this.maxChunkSize) {
        return [{
          id: this.generateChunkId(document.id, 0),
          documentId: document.id,
          content: text,
          metadata: { ...document.metadata, chunkIndex: 0 },
        }];
      }
      return this.splitOversizedText(document, text);
    }

    // 批量嵌入所有句子
    const embeddings = await this.embedding.embedBatch(sentences);

    // 计算相邻句子的余弦相似度
    const breakpoints: number[] = [];
    for (let i = 0; i < embeddings.length - 1; i++) {
      const sim = this.cosineSimilarity(embeddings[i]!, embeddings[i + 1]!);
      if (sim < this.similarityThreshold) {
        breakpoints.push(i + 1); // 在 i+1 处断开
      }
    }

    // 根据断点分组
    const groups: string[][] = [];
    let currentGroup: string[] = [sentences[0]!];

    for (let i = 1; i < sentences.length; i++) {
      if (breakpoints.includes(i)) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push(sentences[i]!);
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    // 合并过小的组，拆分过大的组
    const finalGroups = this.adjustGroups(groups);

    // 生成 chunks
    return finalGroups.map((group, index) => ({
      id: this.generateChunkId(document.id, index),
      documentId: document.id,
      content: group.join(' ').trim(),
      metadata: { ...document.metadata, chunkIndex: index },
    }));
  }

  /**
   * 调整分组：合并过小的、拆分过大的
   *
   * @param groups - 初始分组列表
   * @returns 调整后的分组列表
   */
  private adjustGroups(groups: string[][]): string[][] {
    const result: string[][] = [];

    for (const group of groups) {
      const text = group.join(' ');
      if (text.length < this.minChunkSize && result.length > 0) {
        // 合并到前一组
        const prev = result[result.length - 1]!;
        result[result.length - 1] = [...prev, ...group];
      } else if (text.length > this.maxChunkSize) {
        // 按 maxChunkSize 拆分
        const subGroups = this.splitLargeGroup(group);
        result.push(...subGroups);
      } else {
        result.push(group);
      }
    }

    return result;
  }

  /**
   * 拆分过大的组
   *
   * @param group - 超过 maxChunkSize 的句子组
   * @returns 按 maxChunkSize 拆分后的子组列表
   */
  private splitLargeGroup(group: string[]): string[][] {
    const result: string[][] = [];
    let current: string[] = [];
    let currentLen = 0;

    for (const sentence of group) {
      if (currentLen + sentence.length > this.maxChunkSize && current.length > 0) {
        result.push(current);
        current = [];
        currentLen = 0;
      }
      current.push(sentence);
      currentLen += sentence.length;
    }

    if (current.length > 0) result.push(current);
    return result;
  }

  /**
   * 同步降级：按长度切分句子组
   *
   * @param document - 原始文档
   * @param sentences - 已拆分的句子列表
   * @returns 按 maxChunkSize 分组的 chunk 列表
   */
  private fallbackChunk(document: Document, sentences: string[]): Chunk[] {
    const chunks: Chunk[] = [];
    let current: string[] = [];
    let currentLen = 0;
    let index = 0;

    for (const sentence of sentences) {
      if (currentLen + sentence.length > this.maxChunkSize && current.length > 0) {
        chunks.push({
          id: this.generateChunkId(document.id, index),
          documentId: document.id,
          content: current.join(' ').trim(),
          metadata: { ...document.metadata, chunkIndex: index },
        });
        index++;
        current = [];
        currentLen = 0;
      }
      current.push(sentence);
      currentLen += sentence.length;
    }

    if (current.length > 0) {
      chunks.push({
        id: this.generateChunkId(document.id, index),
        documentId: document.id,
        content: current.join(' ').trim(),
        metadata: { ...document.metadata, chunkIndex: index },
      });
    }

    return chunks;
  }

  /**
   * 拆分句子（支持中英文）
   *
   * @param text - 待拆分的文本
   * @returns 句子数组
   */
  private splitSentences(text: string): string[] {
    // 按中英文句号、问号、感叹号、换行拆分
    const sentences = text.split(/(?<=[。！？.!?\n])\s*/);
    return sentences.filter(s => s.trim().length > 0);
  }

  /**
   * 将超长文本按 maxChunkSize 强制切分为多个 chunk
   *
   * @param document - 原始文档
   * @param text - 超过 maxChunkSize 的文本
   * @returns 按 maxChunkSize 切分后的 chunk 数组
   */
  private splitOversizedText(document: Document, text: string): Chunk[] {
    const chunks: Chunk[] = [];
    let index = 0;

    for (let i = 0; i < text.length; i += this.maxChunkSize) {
      chunks.push({
        id: this.generateChunkId(document.id, index),
        documentId: document.id,
        content: text.slice(i, i + this.maxChunkSize),
        metadata: { ...document.metadata, chunkIndex: index },
      });
      index++;
    }

    return chunks;
  }

  /**
   * 计算两个向量的余弦相似度
   *
   * @param a - 向量 A
   * @param b - 向量 B
   * @returns 余弦相似度值，范围 [-1, 1]
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
