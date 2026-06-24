import type { Chunk, TokenCounter } from './types';

/** CJK 字符正则范围 */
const CJK_REGEX = /[一-鿿가-힯぀-ゟ゠-ヿ]/g;

/** 默认生成预留 token 数 */
const DEFAULT_GENERATION_RESERVED = 500;

/** Token 预算配置 */
export interface TokenBudgetConfig {
  /** 总 token 预算 */
  maxTokens: number;
  /** 系统 prompt 预留 token 数，默认 0 */
  systemReserved?: number;
  /** 生成预留 token 数，默认 500 */
  generationReserved?: number;
}

/**
 * 基于字符数的近似 Token 计数器
 *
 * 适用于无外部 tokenizer 依赖的场景：
 * - CJK 字符（中日韩）：每个字符 ≈ 1 token
 * - 英文及其他字符：每 4 个字符 ≈ 1 token
 *
 * 对于精确计数，建议替换为 tiktoken 等外部实现。
 */
export class CharBasedTokenCounter implements TokenCounter {
  /**
   * 计算文本的近似 token 数量
   *
   * @param text - 输入文本
   * @returns 近似 token 数
   */
  count(text: string): number {
    const cjkChars = (text.match(CJK_REGEX) ?? []).length;
    const otherChars = text.length - cjkChars;

    // CJK 每字约 1 token，其他语言每 4 字符约 1 token
    return cjkChars + Math.ceil(otherChars / 4);
  }
}

/**
 * Token 预算管理器
 *
 * 管理 LLM 调用的 token 分配：
 * - 从总预算中扣除系统 prompt 和生成预留
 * - 剩余预算用于上下文（检索到的 chunks）
 * - 支持按预算截断上下文
 *
 * @example
 * ```ts
 * const budget = new TokenBudgetManager(
 *   { maxTokens: 4096, generationReserved: 500 },
 *   new CharBasedTokenCounter()
 * )
 * const available = budget.getAvailableForContext() // 3596
 * const truncated = budget.truncateContext(chunks)
 * ```
 */
export class DefaultTokenBudgetManager {
  private readonly maxTokens: number;
  private readonly systemReserved: number;
  private readonly generationReserved: number;
  private readonly counter: TokenCounter;

  /**
   * @param config - 预算配置
   * @param config.maxTokens - 总 token 预算
   * @param config.systemReserved - 系统 prompt 预留 token 数
   * @param config.generationReserved - 生成预留 token 数
   * @param counter - Token 计数器，默认使用 CharBasedTokenCounter
   */
  constructor(config: TokenBudgetConfig, counter?: TokenCounter) {
    this.maxTokens = config.maxTokens;
    this.systemReserved = config.systemReserved ?? 0;
    this.generationReserved = config.generationReserved ?? DEFAULT_GENERATION_RESERVED;
    this.counter = counter ?? new CharBasedTokenCounter();
  }

  /**
   * 获取可用于上下文的 token 预算
   *
   * @returns 可用 token 数（总预算 - 系统预留 - 生成预留）
   */
  getAvailableForContext(): number {
    return Math.max(0, this.maxTokens - this.systemReserved - this.generationReserved);
  }

  /**
   * 按 token 预算截断上下文
   *
   * 按顺序累加每个 chunk 的 token 数，超出预算后截断。
   *
   * @param chunks - 文本块列表
   * @returns 截断后的文本块列表
   */
  truncateContext(chunks: Chunk[]): Chunk[] {
    const budget = this.getAvailableForContext();
    let used = 0;
    const result: Chunk[] = [];

    for (const chunk of chunks) {
      const tokens = this.counter.count(chunk.content);
      if (used + tokens > budget) {
        break;
      }
      used += tokens;
      result.push(chunk);
    }

    return result;
  }

  /**
   * 获取当前使用统计
   *
   * @returns 系统预留、生成预留和可用上下文 token 数
   */
  getUsage(): { system: number; context: number; generation: number } {
    return {
      system: this.systemReserved,
      context: this.getAvailableForContext(),
      generation: this.generationReserved,
    };
  }
}
