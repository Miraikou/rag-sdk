import { z } from 'zod';
import type { Chunk, GenerateOptions, LLMProvider } from '@rag-sdk/core';
import type { GroundingVerification, GroundedGenerateResult, PromptTemplate } from './types';
import { StandardGenerator } from './generator';
import { BasePromptTemplate } from './prompt-template';

/** Grounding 验证的 Zod schema */
const GroundingSchema = z.object({
  isGrounded: z.boolean().describe('答案是否完全基于提供的上下文，不包含任何编造信息'),
  unsupportedClaims: z.array(z.string()).describe('无法从上下文中找到依据的声明列表'),
  groundingScore: z.number().min(0).max(1).describe('接地分数，0 表示完全不忠实，1 表示完全忠实于上下文'),
}).describe('Grounding 验证结果：检测答案是否包含上下文之外的幻觉信息');

/**
 * GroundedGenerator
 *
 * 带幻觉检测的答案生成器，继承 StandardGenerator。
 * 生成答案后自动验证其是否忠实于检索上下文，
 * 识别答案中无法从上下文支持的声明。
 */
export class GroundedGenerator extends StandardGenerator {
  /**
   * 创建带幻觉检测的生成器实例
   *
   * @param llm - LLM 提供商实例
   * @param template - Prompt 模板，默认使用严格约束模板
   * @param options - 默认生成选项
   */
  constructor(
    llm: LLMProvider,
    template?: PromptTemplate,
    options?: GenerateOptions,
  ) {
    super(llm, template ?? BasePromptTemplate.strict(), options);
  }

  /**
   * 生成答案并验证其忠实性
   *
   * 先调用父类生成答案，再通过 LLM 验证答案是否完全基于上下文。
   *
   * @param query - 用户查询
   * @param chunks - 检索到的文本块
   * @param options - 生成选项
   * @returns 包含验证结果的生成结果
   */
  override async generate(
    query: string,
    chunks: Chunk[],
    options?: GenerateOptions,
  ): Promise<GroundedGenerateResult> {
    const result = await super.generate(query, chunks, options);

    // 空 chunks 场景无需验证
    if (chunks.length === 0) {
      return {
        ...result,
        verification: {
          isGrounded: false,
          unsupportedClaims: ['无可用的上下文信息'],
          groundingScore: 0,
        },
      };
    }

    const verification = await this.verifyGrounding(result.answer, chunks);

    return {
      ...result,
      verification,
    };
  }

  /**
   * 验证答案是否忠实于上下文
   *
   * 优先使用 chatJson 结构化输出，失败时降级到 chat + JSON.parse。
   *
   * @param answer - 生成的答案文本
   * @param chunks - 检索到的文本块
   * @returns 验证结果，包含是否忠实、不支持的声明和忠实度分数
   */
  private async verifyGrounding(
    answer: string,
    chunks: Chunk[],
  ): Promise<GroundingVerification> {
    const contextText = chunks
      .map((c, i) => `[${i + 1}] ${c.content}`)
      .join('\n\n');

    const messages = [
      {
        role: 'system' as const,
        content: '你是一个答案忠实性验证助手。请判断给定的答案是否完全基于提供的上下文信息，识别答案中无法从上下文支持的声明，并给出忠实度分数。',
      },
      {
        role: 'user' as const,
        content: `上下文信息：\n${contextText}\n\n生成的答案：${answer}\n\n请分析答案是否完全基于上下文，返回 JSON 对象。`,
      },
    ];

    try {
      const schema = z.toJSONSchema(GroundingSchema);
      const result = await this.llm.chatJson<GroundingVerification>(
        messages,
        schema,
      );
      return result;
    } catch {
      // 降级：chatJson 不支持时回退到 chat + JSON.parse
      return this.fallbackVerify(messages);
    }
  }

  /**
   * 降级方案：使用普通 chat + JSON.parse 验证忠实性
   *
   * @param messages - 对话消息列表
   * @returns 验证结果，解析失败时返回保守的默认值
   */
  private async fallbackVerify(
    messages: { role: 'system' | 'user'; content: string }[],
  ): Promise<GroundingVerification> {
    try {
      const result = await this.llm.chat(messages);

      // 提取 JSON 内容（LLM 可能返回 markdown 代码块包裹的 JSON）
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.defaultVerification();
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);

      // 使用 Zod 验证解析结果的形状
      const validated = GroundingSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }

      return this.defaultVerification();
    } catch {
      return this.defaultVerification();
    }
  }

  /**
   * 返回保守的默认验证结果
   *
   * 当验证过程本身出错时使用，标记为不忠实以避免误导。
   *
   * @returns 默认的验证结果
   */
  private defaultVerification(): GroundingVerification {
    return {
      isGrounded: false,
      unsupportedClaims: ['验证过程出错，无法确认答案忠实性'],
      groundingScore: 0,
    };
  }
}
