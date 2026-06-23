import { describe, it, expect, vi } from 'vitest';
import { DocumentAugmenter } from '../src/augmenter';
import type { Document, LLMProvider } from '@rag-sdk/core';

/** 创建测试用文档 */
function makeDoc(id: string, content: string): Document {
  return { id, content, metadata: {} };
}

/**
 * 创建 mock LLMProvider
 *
 * @param summaryResponses - chat() 的响应队列（用于 generateSummary）
 * @param jsonResponses - chatJson() 的响应队列（用于 generateKeywords / generateQA）
 */
function createMockLLM(
  summaryResponses: string[],
  jsonResponses: unknown[],
): LLMProvider {
  const chatFn = vi.fn();
  summaryResponses.forEach((resp) => chatFn.mockResolvedValueOnce(resp));

  const chatJsonFn = vi.fn();
  jsonResponses.forEach((resp) => chatJsonFn.mockResolvedValueOnce(resp));

  return {
    chat: chatFn,
    chatStream: vi.fn(),
    chatJson: chatJsonFn,
  };
}

describe('DocumentAugmenter', () => {
  it('should generate summary and keywords by default', async () => {
    const llm = createMockLLM(
      ['这是一篇关于 TypeScript 的文档'],  // summary（chat）
      [{ keywords: ['TypeScript', 'JavaScript', '类型系统'] }],  // keywords（chatJson）
    );
    const augmenter = new DocumentAugmenter(llm);
    const doc = makeDoc('1', 'TypeScript is a typed superset of JavaScript.');

    const result = await augmenter.augmentDocument(doc);

    expect(result.metadata['summary']).toBe('这是一篇关于 TypeScript 的文档');
    expect(result.metadata['keywords']).toEqual(['TypeScript', 'JavaScript', '类型系统']);
    expect(result.metadata['augmented']).toBe(true);
    expect(result.metadata['augmentedAt']).toBeDefined();
    expect(result.content).toContain('[摘要]');
    expect(result.content).toContain('[关键词]');
    expect(llm.chat).toHaveBeenCalledTimes(1);
    expect(llm.chatJson).toHaveBeenCalledTimes(1);
  });

  it('should generate QA pairs when generateQA is true', async () => {
    const qaPairs = [
      { question: '什么是 TypeScript?', answer: 'TypeScript 是 JavaScript 的超集。' },
      { question: 'TypeScript 的优势?', answer: '静态类型检查。' },
    ];
    const llm = createMockLLM(
      ['摘要内容'],  // summary（chat）
      [
        { keywords: ['关键词1'] },  // keywords（chatJson）
        { qaPairs },  // QA（chatJson）
      ],
    );
    const augmenter = new DocumentAugmenter(llm);
    const doc = makeDoc('1', 'TypeScript is a typed superset of JavaScript.');

    const result = await augmenter.augmentDocument(doc, { generateQA: true, qaPairCount: 2 });

    expect(result.metadata['qaPairs']).toEqual(qaPairs);
    expect(result.content).toContain('[Q] 什么是 TypeScript?');
    expect(result.content).toContain('[A] TypeScript 是 JavaScript 的超集。');
    expect(llm.chat).toHaveBeenCalledTimes(1);
    expect(llm.chatJson).toHaveBeenCalledTimes(2);
  });

  it('should skip summary when generateSummary is false', async () => {
    const llm = createMockLLM(
      [],  // 无 summary 调用
      [{ keywords: ['关键词1', '关键词2'] }],  // keywords（chatJson）
    );
    const augmenter = new DocumentAugmenter(llm);
    const doc = makeDoc('1', 'Some content');

    const result = await augmenter.augmentDocument(doc, {
      generateSummary: false,
      generateKeywords: true,
      generateQA: false,
    });

    expect(result.metadata['summary']).toBeUndefined();
    expect(result.metadata['keywords']).toEqual(['关键词1', '关键词2']);
    expect(result.content).not.toContain('[摘要]');
    expect(result.content).toContain('[关键词]');
    expect(llm.chat).not.toHaveBeenCalled();
    expect(llm.chatJson).toHaveBeenCalledTimes(1);
  });

  it('should handle keywords generation failure gracefully', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValueOnce('摘要内容'),  // summary 成功
      chatStream: vi.fn(),
      chatJson: vi.fn().mockRejectedValueOnce(new Error('API error')),  // keywords 失败
    };
    const augmenter = new DocumentAugmenter(llm);
    const doc = makeDoc('1', 'Some content');

    const result = await augmenter.augmentDocument(doc);

    expect(result.metadata['summary']).toBe('摘要内容');
    expect(result.metadata['keywords']).toEqual([]);
  });

  it('should batch augment multiple documents via augment()', async () => {
    const llm = createMockLLM(
      ['摘要1', '摘要2'],  // 2 个 summary（chat）
      [
        { keywords: ['K1'] },  // doc1 keywords
        { keywords: ['K2'] },  // doc2 keywords
      ],
    );
    const augmenter = new DocumentAugmenter(llm);
    const docs = [
      makeDoc('1', 'First document'),
      makeDoc('2', 'Second document'),
    ];

    const results = await augmenter.augment(docs);

    expect(results).toHaveLength(2);
    expect(results[0]!.metadata['augmented']).toBe(true);
    expect(results[1]!.metadata['augmented']).toBe(true);
    expect(results[0]!.metadata['summary']).toBe('摘要1');
    expect(results[1]!.metadata['summary']).toBe('摘要2');
  });

  it('should append augmented content after separator', async () => {
    const llm = createMockLLM(
      ['这是摘要'],  // summary（chat）
      [{ keywords: ['关键词A'] }],  // keywords（chatJson）
    );
    const augmenter = new DocumentAugmenter(llm);
    const doc = makeDoc('1', '原始内容');

    const result = await augmenter.augmentDocument(doc);

    // 原始内容在前，增强内容用 --- 分隔
    expect(result.content).toMatch(/^原始内容\n\n---\n/);
    expect(result.content).toContain('[摘要] 这是摘要');
    expect(result.content).toContain('[关键词] 关键词A');
  });
});
