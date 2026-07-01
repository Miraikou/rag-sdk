import { describe, it, expect } from 'vitest';
import { DocumentCleaner } from '../src/cleaner';
import type { Document } from '@ragsdk/core';

/** 创建测试用文档 */
function makeDoc(id: string, content: string): Document {
  return { id, content, metadata: {} };
}

describe('DocumentCleaner', () => {
  it('should strip HTML tags and decode HTML entities', () => {
    const cleaner = new DocumentCleaner({ removeHtml: true, removeExtraWhitespace: false });
    const doc = makeDoc('1', '<p>Hello &amp; &lt;world&gt;</p>&nbsp;text');

    const result = cleaner.cleanDocument(doc);

    expect(result.content).toBe('Hello & <world> text');
    expect(result.metadata['cleaned']).toBe(true);
    expect(result.metadata['cleanedAt']).toBeDefined();
  });

  it('should normalize extra whitespace', () => {
    const cleaner = new DocumentCleaner({ removeHtml: false, removeExtraWhitespace: true });
    const doc = makeDoc('1', '  hello   world\n\n\n\nfoo  ');

    const result = cleaner.cleanDocument(doc);

    expect(result.content).toBe('hello world\n\nfoo');
  });

  it('should remove header/footer lines that repeat frequently', () => {
    const cleaner = new DocumentCleaner({
      removeHtml: false,
      removeExtraWhitespace: false,
      removeHeaderFooter: true,
    });

    // 构造一个 15 行的文档，其中 "Page Header" 出现 3 次（>= max(3, 15*0.1)=3）
    const lines = [
      'Page Header',
      'Content line 1',
      'Content line 2',
      'Page Header',
      'Content line 3',
      'Content line 4',
      'Page Header',
      'Content line 5',
      'Content line 6',
      'Content line 7',
      'Content line 8',
      'Content line 9',
      'Content line 10',
      'Content line 11',
      'Content line 12',
    ];
    const doc = makeDoc('1', lines.join('\n'));

    const result = cleaner.cleanDocument(doc);

    expect(result.content).not.toContain('Page Header');
    expect(result.content).toContain('Content line 1');
    expect(result.content).toContain('Content line 12');
  });

  it('should remove special characters while keeping CJK and basic punctuation', () => {
    const cleaner = new DocumentCleaner({
      removeHtml: false,
      removeExtraWhitespace: false,
      removeSpecialChars: true,
    });
    const doc = makeDoc('1', 'Hello 你好 @#$%^&* world!?');

    const result = cleaner.cleanDocument(doc);

    // @#$%^&* 被移除，保留中英文和基本标点
    expect(result.content).toBe('Hello 你好  world!?');
  });

  it('should apply default options (removeHtml + removeExtraWhitespace)', () => {
    const cleaner = new DocumentCleaner();
    const doc = makeDoc('1', '<b>  bold  </b>   text\n\n\n\nmore');

    const result = cleaner.cleanDocument(doc);

    // HTML 被去除，多余空白被合并
    expect(result.content).toBe('bold text\n\nmore');
  });

  it('should batch clean multiple documents via clean()', async () => {
    const cleaner = new DocumentCleaner();
    const docs = [
      makeDoc('1', '<p>First</p>'),
      makeDoc('2', '  Second   doc  '),
    ];

    const results = await cleaner.clean(docs);

    expect(results).toHaveLength(2);
    expect(results[0]!.content).toBe('First');
    expect(results[1]!.content).toBe('Second doc');
    expect(results[0]!.metadata['cleaned']).toBe(true);
    expect(results[1]!.metadata['cleaned']).toBe(true);
  });
});
