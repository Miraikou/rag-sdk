import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIEmbeddingProvider } from '../src/openai.js';

// Mock 全局 fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OpenAIEmbeddingProvider (Openai)', () => {
  let provider: OpenAIEmbeddingProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIEmbeddingProvider({
      apiKey: 'test-key',
      model: 'text-embedding-3-small',
      dimension: 1536,
    });
  });

  it('should create instance with default config', () => {
    expect(provider).toBeDefined();
    expect(provider.dimension).toBe(1536);
  });

  it('should have correct dimension', () => {
    const p = new OpenAIEmbeddingProvider({
      apiKey: 'test-key',
      dimension: 768,
    });
    expect(p.dimension).toBe(768);
  });

  it('should call embed and return vector', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 2, total_tokens: 2 },
      }),
    });

    const result = await provider.embed('hello');
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/embeddings');
  });

  it('should call embedBatch and return vectors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2], index: 0 },
          { embedding: [0.3, 0.4], index: 1 },
        ],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 4, total_tokens: 4 },
      }),
    });

    const results = await provider.embedBatch(['hello', 'world']);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual([0.1, 0.2]);
    expect(results[1]).toEqual([0.3, 0.4]);
  });

  it('should throw on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid API key',
    });

    await expect(provider.embed('test')).rejects.toThrow('Embedding API');
  });

  it('should sort results by index', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.3, 0.4], index: 1 },
          { embedding: [0.1, 0.2], index: 0 },
        ],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 4, total_tokens: 4 },
      }),
    });

    const results = await provider.embedBatch(['first', 'second']);
    expect(results[0]).toEqual([0.1, 0.2]);
    expect(results[1]).toEqual([0.3, 0.4]);
  });

  it('should batch large requests', async () => {
    // 创建超过 MAX_BATCH_SIZE 的请求，验证分批逻辑
    const texts = Array.from({ length: 10 }, (_, i) => `text-${i}`);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: texts.map((_, i) => ({ embedding: [i], index: i })),
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: texts.length, total_tokens: texts.length },
      }),
    });

    const results = await provider.embedBatch(texts);
    expect(results).toHaveLength(texts.length);
  });
});
