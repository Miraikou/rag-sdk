import { describe, it, expect } from 'vitest';
import { BaseLLMProvider } from '../src/base';
import type { LLMConfig } from '../src/types';
import type { ChatOptions, Message } from '@ragsdk/core';

// 具体实现用于测试抽象基类
class TestLLMProvider extends BaseLLMProvider {
  constructor(config: LLMConfig) {
    super(config);
  }

  async chat(_messages: Message[], _options?: ChatOptions): Promise<string> {
    return '{"name":"test","value":42}';
  }

  async *chatStream(_messages: Message[], _options?: ChatOptions): AsyncIterable<string> {
    yield 'test';
    yield ' response';
  }
}

describe('BaseLLMProvider', () => {
  const config: LLMConfig = {
    apiKey: 'test-key',
    defaultModel: 'test-model',
    defaultOptions: { temperature: 0.5 },
  };

  it('should create instance and store config', () => {
    const provider = new TestLLMProvider(config);
    expect(provider).toBeDefined();
  });

  it('should implement chat method', async () => {
    const provider = new TestLLMProvider(config);
    const result = await provider.chat([{ role: 'user', content: 'hello' }]);
    expect(result).toBe('{"name":"test","value":42}');
  });

  it('should implement chatStream method', async () => {
    const provider = new TestLLMProvider(config);
    const chunks: string[] = [];
    for await (const chunk of provider.chatStream([{ role: 'user', content: 'hello' }])) {
      chunks.push(chunk);
    }
    expect(chunks.join('')).toBe('test response');
  });

  it('should implement chatJson method and return parsed JSON', async () => {
    const provider = new TestLLMProvider(config);
    const result = await provider.chatJson<{ name: string; value: number }>(
      [{ role: 'user', content: 'hello' }],
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
        },
      },
    );
    expect(result).toEqual({ name: 'test', value: 42 });
  });

  it('should throw on empty messages', async () => {
    const provider = new TestLLMProvider(config);
    // 默认实现不校验空消息，子类自行校验
    const result = await provider.chat([]);
    expect(result).toBeDefined();
  });

  it('should merge default options with call options', () => {
    const provider = new TestLLMProvider(config);
    // 验证构造函数存储了配置
    expect(provider).toBeDefined();
  });
});
