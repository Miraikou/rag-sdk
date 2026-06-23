import { describe, it, expect, vi } from 'vitest';
import { MetadataExtractor } from '../src/metadata-extractor';
import type { Document, LLMProvider } from '@rag-sdk/core';

/** 创建测试用文档 */
function makeDoc(id: string, content: string): Document {
  return { id, content, metadata: {} };
}

describe('MetadataExtractor', () => {
  it('should extract base metadata: title, charCount, wordCount, lineCount', async () => {
    const extractor = new MetadataExtractor();
    const doc = makeDoc('1', '# TypeScript 指南\nHello world\n第三行');

    const result = await extractor.extractDocument(doc);

    expect(result.metadata['title']).toBe('TypeScript 指南');
    expect(result.metadata['charCount']).toBe(doc.content.length);
    expect(result.metadata['lineCount']).toBe(3);
    expect(result.metadata['extractedAt']).toBeDefined();
    // 中文字符 6 个 + 英文词 2 个
    expect(typeof result.metadata['wordCount']).toBe('number');
  });

  it('should detect Chinese language when Chinese chars dominate', async () => {
    const extractor = new MetadataExtractor();
    const doc = makeDoc('1', '这是一段中文内容，主要介绍人工智能');

    const result = await extractor.extractDocument(doc);

    expect(result.metadata['language']).toBe('zh');
  });

  it('should detect English language when English chars dominate', async () => {
    const extractor = new MetadataExtractor();
    const doc = makeDoc('1', 'This is an English document about machine learning');

    const result = await extractor.extractDocument(doc);

    expect(result.metadata['language']).toBe('en');
  });

  it('should extract title from markdown heading by stripping # prefix', async () => {
    const extractor = new MetadataExtractor();
    const doc = makeDoc('1', '## My Title\nSome content');

    const result = await extractor.extractDocument(doc);

    expect(result.metadata['title']).toBe('My Title');
  });

  it('should use chatJson to extract advanced metadata when useLLM is true', async () => {
    const llm: LLMProvider = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockResolvedValue({
        topic: '技术',
        keywords: ['TypeScript', '编程'],
        summary: '一篇关于 TypeScript 的技术文章',
      }),
    };
    const extractor = new MetadataExtractor(llm);

    const doc = makeDoc('1', 'TypeScript is a typed superset of JavaScript');
    const result = await extractor.extractDocument(doc, { useLLM: true });

    expect(result.metadata['topic']).toBe('技术');
    expect(result.metadata['keywords']).toEqual(['TypeScript', '编程']);
    expect(result.metadata['summary']).toBe('一篇关于 TypeScript 的技术文章');
    expect(llm.chatJson).toHaveBeenCalledTimes(1);
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it('should handle chatJson failure gracefully', async () => {
    const llm: LLMProvider = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockRejectedValue(new Error('API error')),
    };
    const extractor = new MetadataExtractor(llm);

    const doc = makeDoc('1', 'Some content');
    const result = await extractor.extractDocument(doc, { useLLM: true });

    // chatJson 失败时回退为默认值
    expect(result.metadata['topic']).toBe('提取失败');
    expect(result.metadata['keywords']).toEqual([]);
    expect(result.metadata['summary']).toBe('');
  });
});
