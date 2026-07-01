/**
 * @ragsdk/llm-google
 * Google Gemini LLM 适配器
 *
 * 安装: pnpm add @ragsdk/llm-google
 * 无需额外安装 @google/generative-ai，使用原生 fetch 调用 Gemini API
 */

import type { ChatOptions, Message } from '@ragsdk/core';
import { BaseLLMProvider } from '@ragsdk/llm';
import type { LLMConfig } from '@ragsdk/llm';

// ==================== API 响应类型 ====================

interface GeminiPart {
  text?: string;
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
  index: number;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: GeminiContent;
  }>;
}

/** Gemini 角色映射：将标准角色转换为 Gemini 格式 */
function toGeminiRole(role: string): string {
  switch (role) {
    case 'system':
      return 'user'; // Gemini 用 systemInstruction 处理
    case 'assistant':
      return 'model';
    default:
      return 'user';
  }
}

// ==================== 适配器实现 ====================

/**
 * Google Gemini LLM 适配器
 * 使用原生 fetch 调用 Gemini API
 *
 * 支持的模型：gemini-2.5-flash, gemini-2.5-pro 等
 */
export class GoogleProvider extends BaseLLMProvider {
  private defaultModel: string;

  constructor(config: LLMConfig) {
    super(config);
    this.defaultModel = config.defaultModel ?? 'gemini-2.5-flash';
  }

  /** Gemini 不支持服务端 JSON 约束，使用 prompt_only 避免与基类重复注入 */
  override get jsonOutputMode(): 'prompt_only' {
    return 'prompt_only';
  }

  /** Gemini API 基础地址 */
  protected override get baseUrl(): string {
    return this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * 发送聊天请求
   *
   * @param messages - 对话消息列表
   * @param options - 调用选项
   * @returns 模型响应文本
   */
  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    if (messages.length === 0) throw new Error('messages must not be empty');

    const opts = this.mergeOptions(options);
    const model = opts.model ?? this.defaultModel;

    // 提取 system 消息作为 systemInstruction
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Gemini 要求以 user 消息开始，且不能有连续相同角色的消息
    const contents = this.normalizeMessages(nonSystemMessages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
        topP: opts.topP,
        stopSequences: opts.stop,
      },
    };

    if (systemMessages.length > 0) {
      body['systemInstruction'] = {
        parts: systemMessages.map((m) => ({ text: m.content })),
      };
    }

    // 结构化输出支持
    if (opts.responseFormat) {
      const { type, schema } = opts.responseFormat;
      if (type === 'json_object' || (type === 'json_schema' && schema)) {
        const instruction = type === 'json_schema' && schema
          ? `必须严格按以下 JSON Schema 格式输出 JSON：${JSON.stringify(schema, null, 2)}`
          : '必须输出合法的 JSON 对象。';
        const existingInstruction = body['systemInstruction'] as { parts: Array<{ text: string }> } | undefined;
        if (existingInstruction) {
          existingInstruction.parts.push({ text: instruction });
        } else {
          body['systemInstruction'] = { parts: [{ text: instruction }] };
        }
      }
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('Gemini API returned no candidates');
    }

    const text = candidate.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return text;
  }

  /**
   * 流式聊天请求
   *
   * @param messages - 对话消息列表
   * @param options - 调用选项
   * @returns 逐字符的异步迭代器
   */
  async *chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<string> {
    if (messages.length === 0) throw new Error('messages must not be empty');

    const opts = this.mergeOptions(options);
    const model = opts.model ?? this.defaultModel;

    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const contents = this.normalizeMessages(nonSystemMessages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
        topP: opts.topP,
        stopSequences: opts.stop,
      },
    };

    if (systemMessages.length > 0) {
      body['systemInstruction'] = {
        parts: systemMessages.map((m) => ({ text: m.content })),
      };
    }

    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Gemini API returned no response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);

          try {
            const parsed = JSON.parse(data) as GeminiStreamChunk;
            const text = parsed.candidates?.[0]?.content?.parts
              ?.map((p) => p.text ?? '')
              .join('') ?? '';
            if (text) {
              yield text;
            }
          } catch {
            // 忽略 JSON 解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 规范化消息：合并连续相同角色的消息，确保以 user 开头
   *
   * @param messages - 非 system 消息列表
   * @returns Gemini 格式的 contents 数组
   */
  private normalizeMessages(messages: Message[]): GeminiContent[] {
    if (messages.length === 0) return [];

    const result: GeminiContent[] = [];
    for (const msg of messages) {
      const role = toGeminiRole(msg.role);
      const last = result[result.length - 1];

      if (last && last.role === role) {
        // 合并连续相同角色的消息
        last.parts.push({ text: msg.content });
      } else {
        result.push({ role, parts: [{ text: msg.content }] });
      }
    }

    // 确保以 user 消息开始
    if (result.length > 0 && result[0]!.role !== 'user') {
      result.unshift({ role: 'user', parts: [{ text: '' }] });
    }

    return result;
  }
}
