import { describe, it, expect } from 'vitest'
import { MarkdownLoader } from '../../src/loader/markdown-loader'

describe('MarkdownLoader', () => {
  it('默认应将整个 Markdown 内容作为单个文档返回', async () => {
    const loader = new MarkdownLoader()
    const md = '# Title\n\nBody text'
    const docs = await loader.load(Buffer.from(md))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe(md)
  })

  it('默认模式应包含正确的元数据', async () => {
    const loader = new MarkdownLoader()
    const docs = await loader.load(Buffer.from('# Hello'))

    expect(docs[0]!.metadata.loader).toBe('MarkdownLoader')
    expect(docs[0]!.metadata.format).toBe('markdown')
    expect(docs[0]!.metadata.source).toBeDefined()
  })

  it('splitByHeading 应按一级标题拆分为多个文档', async () => {
    const loader = new MarkdownLoader({ splitByHeading: true, headingLevel: 1 })
    const md = '# Title1\nBody 1\n# Title2\nBody 2'
    const docs = await loader.load(Buffer.from(md))

    expect(docs).toHaveLength(2)
    expect(docs[0]!.metadata.heading).toBe('Title1')
    expect(docs[0]!.content).toContain('Body 1')
    expect(docs[1]!.metadata.heading).toBe('Title2')
    expect(docs[1]!.content).toContain('Body 2')
  })

  it('splitByHeading 应按二级标题拆分', async () => {
    const loader = new MarkdownLoader({ splitByHeading: true, headingLevel: 2 })
    const md = '## Section1\nContent 1\n## Section2\nContent 2'
    const docs = await loader.load(Buffer.from(md))

    expect(docs).toHaveLength(2)
    expect(docs[0]!.metadata.heading).toBe('Section1')
    expect(docs[0]!.content).toContain('Content 1')
    expect(docs[1]!.metadata.heading).toBe('Section2')
  })

  it('拆分时应为每个章节分配递增的 sectionIndex', async () => {
    const loader = new MarkdownLoader({ splitByHeading: true, headingLevel: 1 })
    const md = '# A\na\n# B\nb\n# C\nc'
    const docs = await loader.load(Buffer.from(md))

    expect(docs).toHaveLength(3)
    expect(docs[0]!.metadata.sectionIndex).toBe(0)
    expect(docs[1]!.metadata.sectionIndex).toBe(1)
    expect(docs[2]!.metadata.sectionIndex).toBe(2)
  })

  it('标题前的引导文本应作为 preamble 章节保留', async () => {
    const loader = new MarkdownLoader({ splitByHeading: true, headingLevel: 1 })
    const md = 'Some intro\n# Title\nBody'
    const docs = await loader.load(Buffer.from(md))

    expect(docs).toHaveLength(2)
    expect(docs[0]!.metadata.heading).toBe('(preamble)')
    expect(docs[0]!.content).toBe('Some intro')
    expect(docs[1]!.metadata.heading).toBe('Title')
  })

  it('无匹配标题时应将文本作为 preamble 章节保留', async () => {
    const loader = new MarkdownLoader({ splitByHeading: true, headingLevel: 1 })
    const md = 'No headings here\nJust plain text'
    const docs = await loader.load(Buffer.from(md))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.metadata.heading).toBe('(preamble)')
    expect(docs[0]!.content).toContain('No headings here')
  })
})
