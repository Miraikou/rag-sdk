import type { Chunk, Message } from '@rag-sdk/core';
import type { FormatOptions, PromptTemplate } from './types';

/**
 * BasePromptTemplate
 *
 * Prompt 模板基类，支持 {query}、{context}、{sourceCount} 变量插值。
 * 内置 3 种预设模板：default、strict、citation。
 */
export class BasePromptTemplate implements PromptTemplate {
  private systemPrompt: string;
  private userTemplate: string;

  /**
   * 创建 Prompt 模板实例
   *
   * @param systemPrompt - 系统提示词
   * @param userTemplate - 用户消息模板，支持 {query}、{context}、{sourceCount} 变量
   */
  constructor(systemPrompt: string, userTemplate: string) {
    this.systemPrompt = systemPrompt;
    this.userTemplate = userTemplate;
  }

  /**
   * 构建 LLM 对话消息
   *
   * @param query - 用户查询
   * @param chunks - 检索到的文本块
   * @param options - 格式化选项
   * @returns 构建好的消息列表
   */
  format(query: string, chunks: Chunk[], options?: FormatOptions): Message[] {
    const context = this.buildContext(chunks, options?.maxContextLength);
    const sourceCount = String(chunks.length);

    const userContent = this.userTemplate
      .replace(/\{query\}/g, query)
      .replace(/\{context\}/g, context)
      .replace(/\{sourceCount\}/g, sourceCount);

    return [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userContent },
    ];
  }

  /**
   * 拼接 chunk 内容为上下文文本
   *
   * @param chunks - 文本块列表
   * @param maxLength - 最大字符数（超出时截断）
   * @returns 拼接后的上下文文本
   */
  protected buildContext(chunks: Chunk[], maxLength?: number): string {
    const parts: string[] = [];
    let totalLength = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const prefix = `[${i + 1}] `;
      const text = prefix + chunk.content;

      if (maxLength && totalLength + text.length > maxLength) {
        // 截断当前 chunk 以适配长度限制
        const remaining = maxLength - totalLength;
        if (remaining > prefix.length) {
          parts.push(text.slice(0, remaining) + '...');
        }
        break;
      }

      parts.push(text);
      totalLength += text.length;
    }

    return parts.join('\n\n');
  }

  /** 标准 RAG 模板 */
  static default(): BasePromptTemplate {
    return new BasePromptTemplate(
      '你是一个知识库助手。请根据提供的参考资料回答用户问题。如果参考资料不足以回答，请明确说明。',
      '参考资料（共 {sourceCount} 条）：\n{context}\n\n用户问题：{query}',
    );
  }

  /** 严格约束模板：仅基于上下文回答 */
  static strict(): BasePromptTemplate {
    return new BasePromptTemplate(
      '你是一个严谨的知识库助手。你必须严格基于提供的参考资料回答问题，不得添加任何参考资料之外的信息。如果资料不足以回答，请回答"根据现有资料无法回答此问题"。',
      '参考资料（共 {sourceCount} 条）：\n{context}\n\n用户问题：{query}',
    );
  }

  /** 引用标注模板：要求答案中包含引用 */
  static citation(): BasePromptTemplate {
    return new BasePromptTemplate(
      '你是一个知识库助手。请根据参考资料回答问题，并在答案中用 [1]、[2] 等标记引用来源。每条引用对应参考资料中的编号。',
      '参考资料（共 {sourceCount} 条）：\n{context}\n\n用户问题：{query}\n\n请在答案中使用 [1]、[2] 等标记标注引用来源。',
    );
  }
}
