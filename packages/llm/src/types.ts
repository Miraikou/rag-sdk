import type { ChatOptions, Message } from '@ragsdk/core';

export type { ChatOptions, Message } from '@ragsdk/core';

/** LLM 提供商配置 */
export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultOptions?: ChatOptions;
}

/** Provider 支持的结构化输出模式 */
export type JsonOutputMode =
  | 'json_schema'   // 服务端 Schema 约束解码（OpenAI Structured Outputs）
  | 'json_object'   // 服务端保证合法 JSON，但不做字段校验（DeepSeek / OpenAI JSON mode）
  | 'prompt_only';  // 纯 prompt 引导，无服务端约束（兜底）