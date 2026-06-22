import type { LLMProvider, QueryTransformer } from '@rag-sdk/core';

/**
 * MultiQueryExpander
 *
 * 多查询扩展器，从多个不同角度改写原始问题，生成多个查询变体
 *
 * 通过 LLM 生成多个查询变体，提高检索的召回率，适用于需要从不同角度覆盖同一主题的场景
 */
export class MultiQueryExpander implements QueryTransformer {
  private llm: LLMProvider;
  private numQueries: number;
  private temperature: number;

  /**
   * 创建多查询扩展器实例
   *
   * @param llm - LLM 提供商实例
   * @param options - 可选配置项
   * @param options.numQueries - 生成的查询变体数量，默认为 3
   * @param options.temperature - LLM 温度参数，控制生成的多样性，默认为 0.7
   */
  constructor(llm: LLMProvider, options?: { numQueries?: number; temperature?: number }) {
    this.llm = llm;
    this.numQueries = options?.numQueries ?? 3;
    this.temperature = options?.temperature ?? 0.7;
  }

  /**
   * 执行多查询扩展
   *
   * @param query - 原始查询字符串
   * @returns 扩展后的查询数组，每个元素代表一个不同角度的查询变体
   */
  async transform(query: string): Promise<string[]> {
    const result = await this.llm.chat(
      [
        {
          role: 'system',
          content: `你是一个查询扩展助手。请从 ${this.numQueries} 个不同角度改写以下问题，每行一个。
规则：
- 保持原始问题的核心意图
- 每个变体从不同角度出发
- 每行一个查询，不要编号
- 只输出查询，不要解释`,
        },
        { role: 'user', content: query },
      ],
      { temperature: this.temperature },
    );

    return result
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
}
