import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../src/openai';

describe('OpenAIProvider', () => {
  it('should create instance with config', () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
  });

  it('should throw on empty messages', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    await expect(provider.chat([])).rejects.toThrow('messages must not be empty');
  });
});
