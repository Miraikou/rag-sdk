import type { Chunk, Retriever, RetrieveOptions, SearchResult } from '@rag-sdk/core';

/**
 * BM25 关键词搜索
 *
 * 基于经典 BM25 算法的稀疏检索，支持中英文混合分词。
 * 构造时传入 chunk 列表建立倒排索引，查询时逐 chunk 打分。
 */
export class KeywordSearch implements Retriever {
  private chunks: Chunk[] = [];
  private docFreq = new Map<string, number>();
  private k1 = 1.5;
  private b = 0.75;
  private avgDocLen = 0;

  /**
   * 创建 BM25 关键词搜索实例
   *
   * 可选传入初始 chunk 列表，传入时会自动构建倒排索引。
   *
   * @param chunks - 可选的初始文档片段列表
   */
  constructor(chunks?: Chunk[]) {
    if (chunks) {
      this.buildIndex(chunks);
    }
  }

  /** 构建 / 重建 BM25 索引 */
  buildIndex(chunks: Chunk[]): void {
    this.chunks = chunks;
    this.docFreq.clear();
    let totalLen = 0;

    for (const chunk of chunks) {
      const terms = this.tokenize(chunk.content);
      totalLen += terms.length;

      // 每个 chunk 只计一次文档频率（去重）
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }

    this.avgDocLen = chunks.length > 0 ? totalLen / chunks.length : 0;
  }

  /**
   * 执行 BM25 关键词检索
   *
   * 对查询文本分词后，逐 chunk 计算 BM25 相关性得分，返回得分最高的结果。
   *
   * @param query - 查询文本
   * @param options - 检索选项（topK、threshold 等）
   * @returns 按 BM25 得分降序排列的检索结果列表
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    if (this.chunks.length === 0) {
      return [];
    }

    const queryTerms = this.tokenize(query);
    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0;
    const N = this.chunks.length;

    const scored: SearchResult[] = [];

    for (const chunk of this.chunks) {
      const terms = this.tokenize(chunk.content);
      let score = 0;

      for (const qTerm of queryTerms) {
        const df = this.docFreq.get(qTerm) ?? 0;
        if (df === 0) {
          continue;
        }

        // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        // 词频
        const tf = terms.filter((t) => t === qTerm).length;
        const dl = terms.length;

        // BM25 归一化词频
        const tfNorm =
          (tf * (this.k1 + 1)) /
          (tf + this.k1 * (1 - this.b + (this.b * dl) / this.avgDocLen));

        score += idf * tfNorm;
      }

      if (score > 0 && score >= threshold) {
        scored.push({ chunk, score, source: 'keyword' });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * 分词：支持中英文混合
   *
   * 使用 Intl.Segmenter 进行词级别切分，自动识别语言边界。
   * 中英文都能正确处理，无需额外依赖。
   *
   * @param text - 待分词的文本
   * @returns 分词后的词项数组
   */
  private tokenize(text: string): string[] {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    const segments = segmenter.segment(text.toLowerCase());
    const tokens: string[] = [];

    for (const seg of segments) {
      // Intl.Segmenter 的 segment 包含 isWordLike 属性
      // TypeScript 类型定义可能不完整，使用类型断言
      if ('isWordLike' in seg && seg.isWordLike) {
        tokens.push(seg.segment);
      }
    }

    return tokens;
  }
}
