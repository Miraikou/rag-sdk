/**
 * @ragsdk/llm-anthropic
 * Anthropic Claude LLM 适配器
 *
 * 安装: pnpm add @ragsdk/llm-anthropic
 * 无需额外安装 @anthropic-ai/sdk，使用原生 fetch 调用 Anthropic Messages API
 */

import type { ChatOptions, Message } from '@ragsdk/core';
import { BaseLLMProvider } from '@ragsdk/llm';
import type { LLMConfig } from '@ragsdk/llm';

// ==================== API 响应类型 ====================

interface ContentBlock {
  type: 'text';
  text: string;
}

interface AnthropicMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: {
    type: string;
    text?: string;
  };
  content_block?: {
    type: string;
    text?: string;
  };
  usage?: {
    output_tokens: number;
  };
}

// ==================== 适配器实现 ====================

/**
 * Anthropic Claude LLM 适配器
 * 使用原生 fetch 调用 Anthropic Messages API
 *
 * 支持的模型：claude-fable-5, claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5 等
 */
export class AnthropicProvider extends BaseLLMProvider {
  private defaultModel: string;

  constructor(config: LLMConfig) {
    super(config);
    this.defaultModel = config.defaultModel ?? 'claude-sonnet-4-6';
  }

  /** Anthropic 不支持服务端 JSON 约束，使用 prompt_only 避免与基类重复注入 */
  override get jsonOutputMode(): 'prompt_only' {
    return 'prompt_only';
  }

  /** Anthropic API 版本 */
  private get apiVersion(): string {
    return '2023-06-01';
  }

  /** Anthropic API 基础地址 */
  protected override get baseUrl(): string {
    return this.config.baseUrl ?? 'https://api.anthropic.com/v1';
  }

  /** Anthropic 使用 x-api-key 而非 Bearer Token */
  protected override get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': this.apiVersion,
    };
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

    // 提取 system 消息（Anthropic API 要求 system 作为顶层参数）
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature,
      top_p: opts.topP,
      stop_sequences: opts.stop,
      stream: false,
    };

    if (systemMessages.length > 0) {
      body['system'] = systemMessages.map((m) => m.content).join('\n\n');
    }

    // 结构化输出支持：Anthropic 通过工具调用实现，此处使用 prompt 提示方式
    if (opts.responseFormat) {
      const { type, schema } = opts.responseFormat;
      if (type === 'json_object' || (type === 'json_schema' && schema)) {
        const schemaDesc = type === 'json_schema' && schema
          ? `\n必须严格按以下 JSON Schema 格式输出 JSON：\n${JSON.stringify(schema, null, 2)}`
          : '\n必须输出合法的 JSON 对象。';
        const currentSystem = (body['system'] as string) ?? '';
        body['system'] = currentSystem + schemaDesc;
      }
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as AnthropicMessage;
    const textBlock = data.content.find((block) => block.type === 'text');
    if (!textBlock) {
      throw new Error('Anthropic API returned no text content');
    }

    return textBlock.text;
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

    const body: Record<string, unknown> = {
      model,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature,
      top_p: opts.topP,
      stop_sequences: opts.stop,
      stream: true,
    };

    if (systemMessages.length > 0) {
      body['system'] = systemMessages.map((m) => m.content).join('\n\n');
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Anthropic API returned no response body');
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
            const parsed = JSON.parse(data) as AnthropicStreamEvent;
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield parsed.delta.text;
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
}
