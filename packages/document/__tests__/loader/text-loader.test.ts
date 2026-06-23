import { describe, it, expect } from 'vitest'
import { TextLoader } from '../../src/loader/text-loader'

describe('TextLoader', () => {
  it('应从 Buffer 加载纯文本并返回单个文档', async () => {
    const loader = new TextLoader()
    const buf = Buffer.from('Hello World')
    const docs = await loader.load(buf)

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('Hello World')
  })

  it('应生成正确的元数据字段', async () => {
    const loader = new TextLoader()
    const docs = await loader.load(Buffer.from('test'))

    expect(docs[0]!.metadata.source).toBe('buffer')
    expect(docs[0]!.metadata.loader).toBe('TextLoader')
    expect(docs[0]!.metadata.createdAt).toBeDefined()
    expect(typeof docs[0]!.metadata.createdAt).toBe('string')
  })

  it('每次加载应生成唯一的文档 ID', async () => {
    const loader = new TextLoader()
    const docs = await loader.load(Buffer.from('test'))
    const docs2 = await loader.load(Buffer.from('test2'))

    expect(docs[0]!.id).toBeDefined()
    expect(docs2[0]!.id).toBeDefined()
    expect(docs[0]!.id).not.toBe(docs2[0]!.id)
  })

  it('应支持自定义编码选项', async () => {
    const loader = new TextLoader({ encoding: 'ascii' })
    const docs = await loader.load(Buffer.from('ascii text'))

    expect(docs[0]!.content).toBe('ascii text')
  })

  it('应正确处理中文等多字节 UTF-8 文本', async () => {
    const loader = new TextLoader()
    const docs = await loader.load(Buffer.from('你好世界\n第二行'))

    expect(docs[0]!.content).toBe('你好世界\n第二行')
  })

  it('应正确处理空 Buffer', async () => {
    const loader = new TextLoader()
    const docs = await loader.load(Buffer.from(''))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('')
  })
})
