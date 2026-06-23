import { MarkdownChunker } from '../../src/chunking/markdown';
import type { Document } from '@rag-sdk/core';

/**
 * 构造测试文档
 *
 * @param content - 文档内容
 * @param id - 文档 ID，默认 'doc1'
 */
function makeDoc(content: string, id = 'doc1'): Document {
  return { id, content, metadata: {} };
}

describe('MarkdownChunker', () => {
  it('空文档应返回空数组', () => {
    const chunker = new MarkdownChunker();
    const result = chunker.chunk(makeDoc(''));
    expect(result).toEqual([]);

    const result2 = chunker.chunk(makeDoc('   \n  \n  '));
    expect(result2).toEqual([]);
  });

  it('按 h1/h2 标题正确切分文档', () => {
    const chunker = new MarkdownChunker({ chunkSize: 500 });
    const md = `前言部分。

# 第一章

这是第一章的内容。

## 第一节

这是第一节的内容。

## 第二节

这是第二节的内容。

# 第二章

这是第二章的内容。`;

    const result = chunker.chunk(makeDoc(md));

    // 应拆分为 5 个 chunk：前言、第一章、第一节、第二节、第二章
    expect(result).toHaveLength(5);

    expect(result[0]!.metadata.heading).toBe('');
    expect(result[0]!.metadata.headingLevel).toBe(0);

    expect(result[1]!.metadata.heading).toBe('第一章');
    expect(result[1]!.metadata.headingLevel).toBe(1);

    expect(result[2]!.metadata.heading).toBe('第一节');
    expect(result[2]!.metadata.headingLevel).toBe(2);

    expect(result[3]!.metadata.heading).toBe('第二节');
    expect(result[3]!.metadata.headingLevel).toBe(2);

    expect(result[4]!.metadata.heading).toBe('第二章');
    expect(result[4]!.metadata.headingLevel).toBe(1);
  });

  it('超长章节应被二次切分为多个子 chunk', () => {
    const chunker = new MarkdownChunker({ chunkSize: 50 });

    // 构造一个超过 50 字符的章节
    const longParagraph = '这是一段很长的文本。'.repeat(10);
    const md = `# 长章节

${longParagraph}

这是第二段内容，同样非常长。
`;

    const result = chunker.chunk(makeDoc(md));

    // 超过 chunkSize 时应该产生多个 chunk
    expect(result.length).toBeGreaterThan(1);
    // 所有 chunk 都属于同一文档
    result.forEach((chunk) => {
      expect(chunk.documentId).toBe('doc1');
    });
  });

  it('includeHeadings 为 true 时 chunk 内容包含标题行', () => {
    const chunker = new MarkdownChunker({ includeHeadings: true, chunkSize: 500 });
    const md = `前言。

# 标题一

正文内容。`;

    const result = chunker.chunk(makeDoc(md));

    expect(result).toHaveLength(2);
    // 第二个 chunk 应包含标题行和正文
    expect(result[1]!.content).toContain('# 标题一');
    expect(result[1]!.content).toContain('正文内容。');
  });

  it('includeHeadings 为 false 时 chunk 内容不包含标题行', () => {
    const chunker = new MarkdownChunker({ includeHeadings: false, chunkSize: 500 });
    const md = `前言。

# 标题一

正文内容。`;

    const result = chunker.chunk(makeDoc(md));

    expect(result).toHaveLength(2);
    // 第二个 chunk 不应包含标题行，只有正文
    expect(result[1]!.content).not.toContain('# 标题一');
    expect(result[1]!.content).toBe('正文内容。');
  });

  it('maxHeadingLevel 控制哪些层级触发切分', () => {
    // maxHeadingLevel = 1，只按 h1 切分，h2 作为普通内容保留
    const chunker = new MarkdownChunker({ maxHeadingLevel: 1, chunkSize: 500 });
    const md = `前言。

# 第一章

正文。

## 不应切分的子标题

子标题内容。

# 第二章

第二章正文。`;

    const result = chunker.chunk(makeDoc(md));

    // 前言 + 第一章（含 h2）+ 第二章 = 3 个 chunk
    expect(result).toHaveLength(3);
    expect(result[1]!.metadata.heading).toBe('第一章');
    // h2 标题应保留在第一章 chunk 的内容中
    expect(result[1]!.content).toContain('## 不应切分的子标题');
    expect(result[2]!.metadata.heading).toBe('第二章');
  });

  it('首个标题前的内容应被保留', () => {
    const chunker = new MarkdownChunker({ chunkSize: 500 });
    const md = `这是标题前的前言内容。

# 正文开始

正文内容。`;

    const result = chunker.chunk(makeDoc(md));

    expect(result.length).toBeGreaterThanOrEqual(2);
    // 第一个 chunk 无标题，保留前言内容
    expect(result[0]!.metadata.heading).toBe('');
    expect(result[0]!.metadata.headingLevel).toBe(0);
    expect(result[0]!.content).toContain('这是标题前的前言内容。');
  });

  it('chunk ID 格式正确且序号递增', () => {
    const chunker = new MarkdownChunker({ chunkSize: 500 });
    const md = `前言。

# A

内容A。

# B

内容B。`;

    const result = chunker.chunk(makeDoc(md, 'myDoc'));

    // 前言(0) + A(1) + B(2) = 3 个 chunk
    expect(result).toHaveLength(3);
    expect(result[1]!.id).toBe('myDoc_chunk_1');
    expect(result[2]!.id).toBe('myDoc_chunk_2');
    expect(result[1]!.metadata.chunkIndex).toBe(1);
    expect(result[2]!.metadata.chunkIndex).toBe(2);
  });
});
