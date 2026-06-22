import { z } from 'zod';
import type { LLMProvider, PostProcessor, SearchResult } from '@rag-sdk/core';

/** 相关性判断的结构化输出 schema */
const RelevanceSchema = z.object({
  relevantIndices: z.array(z.number().int().min(1)),
});

/**
 * 选择性上下文后处理器
 *
 * 使用 LLM 逐句判断 chunk 内容中与 query 相关的句子，
 * 只保留相关句子，减少无关信息对生成的干扰。
 *
 * 与 CompressionPostProcessor 的区别：
 * - 本处理器是「选择」——从原文中筛选相关句子
 * - CompressionPostProcessor 是「压缩」——用 LLM 重写/摘要内容
 */
export class SelectiveContextPostProcessor implements PostProcessor {
  private llm: LLMProvider;

  /**
   * 创建选择性上下文后处理器实例
   *
   * @param llm - LLM 提供者实例，用于判断句子与 query 的相关性
   */
  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /**
   * 对检索结果进行选择性过滤
   *
   * 将每个 chunk 拆分为句子，通过 LLM 判断哪些句子与 query 相关，
   * 只保留相关句子。如果某个 chunk 的所有句子都被判定为不相关，
   * 则该 chunk 会被整体丢弃。
   *
   * @param results - 待过滤的检索结果列表
   * @param query - 用户查询文本，用于判断句子相关性
   * @returns 仅保留相关句子的检索结果列表（不相关的 chunk 会被丢弃）
   */
  async process(results: SearchResult[], query: string): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    const processed: SearchResult[] = [];

    for (const result of results) {
      const sentences = this.splitSentences(result.chunk.content);
      if (sentences.length <= 1) {
        // 单句不需要过滤
        processed.push(result);
        continue;
      }

      const relevantSentences = await this.filterRelevantSentences(
        sentences,
        query,
      );

      if (relevantSentences.length > 0) {
        processed.push({
          ...result,
          chunk: {
            ...result.chunk,
            content: relevantSentences.join(' '),
          },
        });
      }
      // 所有句子都不相关时，丢弃该 chunk
    }

    return processed;
  }

  /**
   * 使用 LLM 判断哪些句子与 query 相关
   *
   * 优先使用 chatJson 结构化输出，失败时降级到 prompt + parse 方式。
   *
   * @param sentences - 待判断的句子数组
   * @param query - 用户查询文本
   * @returns 与 query 相关的句子数组
   */
  private async filterRelevantSentences(
    sentences: string[],
    query: string,
  ): Promise<string[]> {
    const numberedSentences = sentences
      .map((s, i) => `[${i + 1}] ${s}`)
      .join('\n');

    try {
      const schema = z.toJSONSchema(RelevanceSchema);
      const result = await this.llm.chatJson<{ relevantIndices: number[] }>(
        [
          {
            role: 'system',
            content: `你是一个文本相关性判断助手。给定一段文本和一个问题，请判断每个句子是否与问题相关。
返回 JSON 对象，格式为 { "relevantIndices": [1, 3, 5] }，其中数字为相关句子的编号（从 1 开始）。
如果没有相关句子，返回 { "relevantIndices": [] }。
只输出 JSON，不要解释。`,
          },
          {
            role: 'user',
            content: `问题：${query}\n\n文本：\n${numberedSentences}`,
          },
        ],
        schema,
      );

      const relevantIndices = result.relevantIndices
        .map((n) => n - 1)
        .filter((i) => i >= 0 && i < sentences.length);

      return relevantIndices
        .map((i) => sentences[i] as string)
        .filter(Boolean);
    } catch {
      // 降级：chatJson 不支持时回退到 prompt + parse
      return this.fallbackFilterRelevantSentences(sentences, query, numberedSentences);
    }
  }

  /**
   * 降级方案：使用普通 chat + 正则解析相关句子编号
   *
   * @param sentences - 待判断的句子数组
   * @param query - 用户查询文本
   * @param numberedSentences - 已编号的句子文本
   * @returns 与 query 相关的句子数组
   */
  private async fallbackFilterRelevantSentences(
    sentences: string[],
    query: string,
    numberedSentences: string,
  ): Promise<string[]> {
    const response = await this.llm.chat([
      {
        role: 'system',
        content: `你是一个文本相关性判断助手。给定一段文本和一个问题，请判断每个句子是否与问题相关。
只输出相关句子的编号，每行一个编号。如果没有相关句子，输出 NONE。`,
      },
      {
        role: 'user',
        content: `问题：${query}\n\n文本：\n${numberedSentences}`,
      },
    ]);

    const trimmed = response.trim();
    if (trimmed === 'NONE' || trimmed.length === 0) {
      return [];
    }

    // 从 LLM 返回中提取所有数字（兼容各种格式：1\n2\n3 / 1, 2, 3 / 1、2、3 等）
    const numbers = trimmed.match(/\d+/g) ?? [];
    const relevantIndices = numbers
      .map((n) => parseInt(n, 10) - 1)
      .filter((i) => i >= 0 && i < sentences.length);

    return relevantIndices
      .map((i) => sentences[i] as string)
      .filter(Boolean);
  }

  /**
   * 将文本拆分为句子
   *
   * 支持中英文句子分隔符（。！？.!? 及换行符）。
   *
   * @param text - 待拆分的文本
   * @returns 句子数组（已过滤空白）
   */
  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[。！？.!?\n])\s*/)
      .filter((s) => s.trim().length > 0);
  }
}
