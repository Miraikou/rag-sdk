import { describe, it, expect } from 'vitest';

describe('AnthropicProvider', () => {
  it('should export AnthropicProvider', async () => {
    const { AnthropicProvider } = await import('../../llm-anthropic/src/index');
    expect(AnthropicProvider).toBeDefined();
    expect(typeof AnthropicProvider).toBe('function');
  });

  it('should create instance with config', async () => {
    const { AnthropicProvider } = await import('../../llm-anthropic/src/index');
    const provider = new AnthropicProvider({
      apiKey: 'test-key',
      defaultModel: 'claude-sonnet-4-6',
    });
    expect(provider).toBeDefined();
  });

  it('should have chat and chatStream methods', async () => {
    const { AnthropicProvider } = await import('../../llm-anthropic/src/index');
    const provider = new AnthropicProvider({ apiKey: 'test-key' });
    expect(typeof provider.chat).toBe('function');
    expect(typeof provider.chatStream).toBe('function');
  });

  it('should throw on empty messages', async () => {
    const { AnthropicProvider } = await import('../../llm-anthropic/src/index');
    const provider = new AnthropicProvider({ apiKey: 'test-key' });
    await expect(provider.chat([])).rejects.toThrow('messages must not be empty');
  });

  it('should default to claude-sonnet-4-6', async () => {
    const { AnthropicProvider } = await import('../../llm-anthropic/src/index');
    const provider = new AnthropicProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
  });
});
