import type { Chunk, Citation, GenerateResult, Message } from '@ragsdk/core';

export type { Chunk, Citation, GenerateResult, Message } from '@ragsdk/core';

/** PromptTemplate 格式化选项 */
export interface FormatOptions {
  /** 上下文最大字符数，超出时截断 */
  maxContextLength?: number;
  /** 是否包含 chunk 元数据 */
  includeMetadata?: boolean;
}

/** Prompt 模板接口 */
export interface PromptTemplate {
  /**
   * 构建 LLM 对话消息
   *
   * @param query - 用户查询
   * @param chunks - 检索到的文本块
   * @param options - 格式化选项
   * @returns 构建好的消息列表
   */
  format(query: string, chunks: Chunk[], options?: FormatOptions): Message[];
}

/** Grounding 验证结果 */
export interface GroundingVerification {
  /** 答案是否完全基于上下文 */
  isGrounded: boolean;
  /** 无法从上下文支持的声明 */
  unsupportedClaims: string[];
  /** 接地分数（0-1，1 表示完全忠实） */
  groundingScore: number;
}

/** GroundedGenerator 的生成结果 */
export interface GroundedGenerateResult extends GenerateResult {
  verification: GroundingVerification;
}

/** CitationGenerator 的生成结果 */
export interface CitationGenerateResult extends GenerateResult {
  /** 带引用标注的答案文本 */
  citedAnswer: string;
  /** 来源列表文本 */
  sourceList: string;
}

/** Self-RAG 反思标记 */
export interface ReflectionTokens {
  /** 是否需要检索 */
  needsRetrieval: boolean;
  /** 检索结果是否相关 */
  retrievalRelevant: boolean;
  /** 答案是否忠实于上下文 */
  answerFaithful: boolean;
}

/** SelfRAGGenerator 的生成结果 */
export interface SelfRAGResult extends GenerateResult {
  /** 反思标记 */
  reflection: ReflectionTokens;
  /** 是否经过重新生成 */
  regenerated: boolean;
  /** 总轮数 */
  rounds: number;
}

/** ConsistencyChecker 的一致性检查结果 */
export interface ConsistencyResult {
  /** 多次生成的答案列表 */
  answers: string[];
  /** 一致性分数（0-1，1 表示完全一致） */
  consistencyScore: number;
  /** 最佳答案 */
  bestAnswer: string;
  /** 冲突点列表 */
  conflicts: string[];
}
