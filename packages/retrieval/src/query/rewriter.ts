import type { LLMProvider, QueryTransformer } from '@ragsdk/core';

/**
 * QueryRewriter
 *
 * 查询改写器，将用户的模糊问题改写为更适合知识库检索的精确查询
 *
 * 通过 LLM 对原始查询进行语义理解和改写，保留原始意图的同时补充相关领域术语，去除口语化表达
 */
export class QueryRewriter implements QueryTransformer {
  private llm: LLMProvider;
  private rewritePrompt: string;

  /**
   * 创建查询改写器实例
   *
   * @param llm - LLM 提供商实例
   * @param rewritePrompt - 可选的自定义改写提示词，不提供则使用默认提示词
   */
  constructor(llm: LLMProvider, rewritePrompt?: string) {
    this.llm = llm;
    this.rewritePrompt = rewritePrompt ?? `你是一个查询改写助手。请将用户的模糊问题改写为更适合知识库检索的精确查询。
规则：
- 保留原始意图
- 补充相关领域术语
- 去除口语化表达
- 只输出改写后的查询，不要解释`;
  }

  /**
   * 执行查询改写
   *
   * @param query - 原始查询字符串
   * @returns 改写后的查询字符串
   */
  async transform(query: string): Promise<string> {
    const result = await this.llm.chat([
      { role: 'system', content: this.rewritePrompt },
      { role: 'user', content: query },
    ]);
    return result.trim();
  }
}
