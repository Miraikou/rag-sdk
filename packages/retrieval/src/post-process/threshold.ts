import type { PostProcessor, SearchResult } from '@rag-sdk/core';

/**
 * 阈值后处理器
 *
 * 根据相似度分数过滤掉低于阈值的检索结果。
 * 零依赖，纯同步操作。
 */
export class ThresholdPostProcessor implements PostProcessor {
  private threshold: number;
  private maxResults: number;

  /**
   * 创建阈值后处理器实例
   *
   * @param options - 配置项
   * @param options.threshold - 相似度分数阈值，低于此值的结果将被过滤，默认 0.5
   * @param options.maxResults - 最大返回结果数量，默认 10
   */
  constructor(options?: { threshold?: number; maxResults?: number }) {
    this.threshold = options?.threshold ?? 0.5;
    this.maxResults = options?.maxResults ?? 10;
  }

  /**
   * 对检索结果进行阈值过滤
   *
   * 按相似度分数降序排列，过滤低于阈值的结果，并限制最大返回数量。
   *
   * @param results - 待过滤的检索结果列表
   * @returns 过滤并截断后的检索结果列表
   */
  async process(results: SearchResult[]): Promise<SearchResult[]> {
    // 按分数降序排列
    const sorted = [...results].sort((a, b) => b.score - a.score);

    // 过滤低于阈值的结果
    const filtered = sorted.filter((r) => r.score >= this.threshold);

    // 限制最大返回数量
    return filtered.slice(0, this.maxResults);
  }
}
