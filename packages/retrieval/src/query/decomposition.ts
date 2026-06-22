import type { LLMProvider, QueryTransformer } from '@rag-sdk/core';

/**
 * QueryDecomposer
 *
 * 查询分解器，将复杂问题拆解为多个可独立检索的子问题
 *
 * 通过 LLM 将复杂的多意图问题分解为多个独立的子问题，每个子问题可单独检索，最后汇总结果以回答原始问题
 */
export class QueryDecomposer implements QueryTransformer {
  private llm: LLMProvider;
  private maxSubQueries: number;

  /**
   * 创建查询分解器实例
   *
   * @param llm - LLM 提供商实例
   * @param options - 可选配置项
   * @param options.maxSubQueries - 最大子问题数量，默认为 5
   */
  constructor(llm: LLMProvider, options?: { maxSubQueries?: number }) {
    this.llm = llm;
    this.maxSubQueries = options?.maxSubQueries ?? 5;
  }

  /**
   * 执行查询分解
   *
   * @param query - 原始查询字符串
   * @returns 分解后的子问题数组，如果问题已经足够简单则返回包含原始问题的数组
   */
  async transform(query: string): Promise<string[]> {
    const result = await this.llm.chat([
      {
        role: 'system',
        content: `你是一个问题拆解助手。请将以下复杂问题拆解为最多 ${this.maxSubQueries} 个可独立检索的子问题。
规则：
- 每个子问题应可独立回答
- 子问题组合起来应覆盖原始问题
- 每行一个子问题，不要编号
- 只输出子问题，不要解释
- 如果问题已经足够简单，直接返回原问题`,
      },
      { role: 'user', content: query },
    ]);

    const subQueries = result
      .split('\n')
      .map(line => line.replace(/^\d+[.)]\s*/, '').trim()) // 去掉可能的编号前缀
      .filter(line => line.length > 0);

    return subQueries.length > 0 ? subQueries : [query];
  }
}
