import { describe, it, expect } from 'vitest';
import { RetrievalRouter } from '../src/router';
import type { RouteRule, Retriever, SearchResult } from '@rag-sdk/core';

// 创建一个简单的 mock retriever
function createMockRetriever(name: string): Retriever {
  return {
    retrieve: async (_query: string) => {
      return [
        {
          chunk: { id: `${name}-c1`, documentId: 'd1', content: `Result from ${name}`, metadata: {} },
          score: 0.9,
          source: 'vector',
        },
      ];
    },
  };
}

describe('RetrievalRouter', () => {
  it('should return default retriever when no rules match', async () => {
    const defaultRetriever = createMockRetriever('default');
    const router = new RetrievalRouter(defaultRetriever);

    const decision = await router.route('some random query');
    expect(decision.type).toBe('default');
    expect(decision.retriever).toBe(defaultRetriever);
  });

  it('should match rule by match function', async () => {
    const defaultRetriever = createMockRetriever('default');
    const keywordRetriever = createMockRetriever('keyword');
    const vectorRetriever = createMockRetriever('vector');

    const rules: RouteRule[] = [
      {
        name: 'short-query',
        match: (query: string) => query.length <= 10,
        retriever: keywordRetriever,
      },
      {
        name: 'long-query',
        match: (query: string) => query.length > 10,
        retriever: vectorRetriever,
      },
    ];

    const router = new RetrievalRouter(defaultRetriever, rules);

    const shortDecision = await router.route('short');
    expect(shortDecision.type).toBe('short-query');

    const longDecision = await router.route('this is a long query');
    expect(longDecision.type).toBe('long-query');
  });

  it('should return first matching rule in order', async () => {
    const defaultRetriever = createMockRetriever('default');
    const retriever1 = createMockRetriever('first');
    const retriever2 = createMockRetriever('second');

    const rules: RouteRule[] = [
      {
        name: 'first-match',
        match: () => true,
        retriever: retriever1,
      },
      {
        name: 'second-match',
        match: () => true,
        retriever: retriever2,
      },
    ];

    const router = new RetrievalRouter(defaultRetriever, rules);
    const decision = await router.route('anything');
    expect(decision.type).toBe('first-match');
  });

  it('should support async match functions', async () => {
    const defaultRetriever = createMockRetriever('default');
    const asyncRetriever = createMockRetriever('async');

    const rules: RouteRule[] = [
      {
        name: 'async-rule',
        match: async (query: string) => {
          return Promise.resolve(query.includes('async'));
        },
        retriever: asyncRetriever,
      },
    ];

    const router = new RetrievalRouter(defaultRetriever, rules);
    const matchDecision = await router.route('test async query');
    expect(matchDecision.type).toBe('async-rule');

    const noMatchDecision = await router.route('test query');
    expect(noMatchDecision.type).toBe('default');
  });

  it('should add rules dynamically', async () => {
    const defaultRetriever = createMockRetriever('default');
    const addedRetriever = createMockRetriever('added');

    const router = new RetrievalRouter(defaultRetriever);
    router.addRule({
      name: 'added-rule',
      match: () => true,
      retriever: addedRetriever,
    });

    const decision = await router.route('test');
    expect(decision.type).toBe('added-rule');
  });

  it('should support rule options', async () => {
    const defaultRetriever = createMockRetriever('default');
    const retriever = createMockRetriever('with-options');

    const rules: RouteRule[] = [
      {
        name: 'option-rule',
        match: () => true,
        retriever,
        options: { topK: 10, threshold: 0.5 },
      },
    ];

    const router = new RetrievalRouter(defaultRetriever, rules);
    const decision = await router.route('test');
    expect(decision.options).toEqual({ topK: 10, threshold: 0.5 });
  });

  it('should use the provided retriever to retrieve results', async () => {
    const defaultRetriever = createMockRetriever('default');
    const router = new RetrievalRouter(defaultRetriever);

    const decision = await router.route('test');
    const results = await decision.retriever.retrieve('test');
    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.content).toBe('Result from default');
  });
});
