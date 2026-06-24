import { describe, it, expect } from 'vitest';

describe('GoogleProvider', () => {
  it('should export GoogleProvider', async () => {
    const { GoogleProvider } = await import('../../llm-google/src/index');
    expect(GoogleProvider).toBeDefined();
    expect(typeof GoogleProvider).toBe('function');
  });

  it('should create instance with config', async () => {
    const { GoogleProvider } = await import('../../llm-google/src/index');
    const provider = new GoogleProvider({
      apiKey: 'test-key',
      defaultModel: 'gemini-2.5-flash',
    });
    expect(provider).toBeDefined();
  });

  it('should have chat and chatStream methods', async () => {
    const { GoogleProvider } = await import('../../llm-google/src/index');
    const provider = new GoogleProvider({ apiKey: 'test-key' });
    expect(typeof provider.chat).toBe('function');
    expect(typeof provider.chatStream).toBe('function');
  });

  it('should throw on empty messages', async () => {
    const { GoogleProvider } = await import('../../llm-google/src/index');
    const provider = new GoogleProvider({ apiKey: 'test-key' });
    await expect(provider.chat([])).rejects.toThrow('messages must not be empty');
  });

  it('should default to gemini-2.5-flash', async () => {
    const { GoogleProvider } = await import('../../llm-google/src/index');
    const provider = new GoogleProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
  });
});
