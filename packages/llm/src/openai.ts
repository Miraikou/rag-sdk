import type { ChatOptions, Message } from '@rag-sdk/core';
import { BaseLLMProvider } from './base';
import type { LLMConfig } from './types';

/** OpenAI API 响应格式 */
interface ChatCompletionResponse {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
}

/** OpenAI 流式响应 chunk */
interface StreamChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
}

/** OpenAI LLM 适配器 */
export class OpenAIProvider extends BaseLLMProvider {
  private defaultModel: string;

  constructor(config: LLMConfig) {
    super(config);
    this.defaultModel = config.defaultModel ?? 'gpt-4o-mini';
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const opts = this.mergeOptions(options);
    const model = opts.model ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        top_p: opts.topP,
        stop: opts.stop,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const firstChoice = data.choices[0];
    if (!firstChoice) {
      throw new Error('OpenAI API returned no choices');
    }

    return firstChoice.message.content;
  }

  async *chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<string> {
    const opts = this.mergeOptions(options);
    const model = opts.model ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        top_p: opts.topP,
        stop: opts.stop,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('OpenAI API returned no response body');
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
        // 保留最后一个可能不完整的行
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data) as StreamChunk;
            const firstChoice = parsed.choices[0];
            if (firstChoice?.delta?.content) {
              yield firstChoice.delta.content;
            }
          } catch {
            // 忽略 JSON 解析错误（可能是不完整的 SSE 行）
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
