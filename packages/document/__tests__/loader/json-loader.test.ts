import { describe, it, expect } from 'vitest'
import { JSONLoader } from '../../src/loader/json-loader'

describe('JSONLoader', () => {
  it('无选项时应将整个 JSON 作为文档内容', async () => {
    const loader = new JSONLoader()
    const data = { title: 'test', body: 'hello' }
    const docs = await loader.load(Buffer.from(JSON.stringify(data)))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe(JSON.stringify(data, null, 2))
    expect(docs[0]!.metadata.loader).toBe('JSONLoader')
    expect(docs[0]!.metadata.format).toBe('json')
  })

  it('contentPath 应提取指定字段作为内容', async () => {
    const loader = new JSONLoader({ contentPath: 'data.text' })
    const data = { data: { text: 'extracted content', other: 'ignored' } }
    const docs = await loader.load(Buffer.from(JSON.stringify(data)))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('extracted content')
  })

  it('contentPath 指向数组时应为每个元素生成一个文档', async () => {
    const loader = new JSONLoader({ contentPath: 'items' })
    const data = { items: ['item1', 'item2', 'item3'] }
    const docs = await loader.load(Buffer.from(JSON.stringify(data)))

    expect(docs).toHaveLength(3)
    expect(docs[0]!.content).toBe('item1')
    expect(docs[1]!.content).toBe('item2')
    expect(docs[2]!.content).toBe('item3')
  })

  it('数组元素的文档元数据应包含正确的 index', async () => {
    const loader = new JSONLoader({ contentPath: 'items' })
    const data = { items: ['a', 'b'] }
    const docs = await loader.load(Buffer.from(JSON.stringify(data)))

    expect(docs[0]!.metadata.index).toBe(0)
    expect(docs[1]!.metadata.index).toBe(1)
  })

  it('数组中的对象元素应被序列化为 JSON 字符串', async () => {
    const loader = new JSONLoader({ contentPath: 'data' })
    const data = { data: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] }
    const docs = await loader.load(Buffer.from(JSON.stringify(data)))

    expect(docs).toHaveLength(2)
    expect(docs[0]!.content).toBe(JSON.stringify({ id: 1, name: 'Alice' }, null, 2))
    expect(docs[1]!.content).toBe(JSON.stringify({ id: 2, name: 'Bob' }, null, 2))
  })

  it('metadataPaths 应将指定字段提取到元数据中', async () => {
    const loader = new JSONLoader({
      contentPath: 'body',
      metadataPaths: ['author', 'tags'],
    })
    const data = { body: 'content', author: 'Alice', tags: ['tech', 'ai'] }
    const docs = await loader.load(Buffer.from(JSON.stringify(data)))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('content')
    expect(docs[0]!.metadata.author).toBe('Alice')
    expect(docs[0]!.metadata.tags).toEqual(['tech', 'ai'])
  })

  it('metadataPaths 应支持嵌套路径提取', async () => {
    const loader = new JSONLoader({
      contentPath: 'data.content',
      metadataPaths: ['data.version'],
    })
    const data = { data: { content: 'hello', version: '1.0', extra: 'skip' } }
    const docs = await loader.load(Buffer.from(JSON.stringify(data)))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('hello')
    expect(docs[0]!.metadata['data.version']).toBe('1.0')
    expect(docs[0]!.metadata['data.extra']).toBeUndefined()
  })

  it('不存在的 metadataPaths 应被忽略', async () => {
    const loader = new JSONLoader({
      contentPath: 'text',
      metadataPaths: ['nonexistent', 'deep.path'],
    })
    const data = { text: 'hello' }
    const docs = await loader.load(Buffer.from(JSON.stringify(data)))

    expect(docs[0]!.metadata.nonexistent).toBeUndefined()
    expect(docs[0]!.metadata['deep.path']).toBeUndefined()
  })
})
