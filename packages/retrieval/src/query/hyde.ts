import type { LLMProvider, QueryTransformer } from '@rag-sdk/core';

/**
 * HyDETransformer
 *
 * 假设文档嵌入（Hypothetical Document Embeddings）转换器
 *
 * 基于 HyDE 论文实现，先通过 LLM 生成一个假设性的专业回答，再用该回答进行检索，提升语义匹配的准确性
 */
export class HyDETransformer implements QueryTransformer {
  private llm: LLMProvider;
  private generatePrompt: string;

  /**
   * 创建 HyDE 转换器实例
   *
   * @param llm - LLM 提供商实例
   * @param generatePrompt - 可选的自定义生成提示词，不提供则使用默认提示词
   */
  constructor(llm: LLMProvider, generatePrompt?: string) {
    this.llm = llm;
    this.generatePrompt = generatePrompt ?? `请根据以下问题生成一个假设性的专业回答。
规则：
- 像知识库中的文档一样回答
- 使用正式、专业的语言
- 不需要完全准确，重点是格式和风格要像文档
- 直接输出回答内容，不要加"假设性回答"等前缀`;
  }

  /**
   * 执行 HyDE 转换
   *
   * @param query - 原始查询字符串
   * @returns 生成的假设性文档内容
   */
  async transform(query: string): Promise<string> {
    const result = await this.llm.chat([
      { role: 'system', content: this.generatePrompt },
      { role: 'user', content: query },
    ]);
    return result.trim();
  }
}
