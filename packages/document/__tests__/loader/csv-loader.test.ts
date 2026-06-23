import { describe, it, expect } from 'vitest'
import { CSVLoader } from '../../src/loader/csv-loader'

describe('CSVLoader', () => {
  it('应将每行数据解析为一个文档（首行为表头）', async () => {
    const loader = new CSVLoader()
    const csv = 'name,age\nAlice,30\nBob,25'
    const docs = await loader.load(Buffer.from(csv))

    expect(docs).toHaveLength(2)
    expect(docs[0]!.metadata.name).toBe('Alice')
    expect(docs[0]!.metadata.age).toBe('30')
    expect(docs[1]!.metadata.name).toBe('Bob')
    expect(docs[1]!.metadata.age).toBe('25')
  })

  it('无 contentColumns 时应将所有列值拼接为文档内容', async () => {
    const loader = new CSVLoader()
    const csv = 'name,city\nAlice,Beijing'
    const docs = await loader.load(Buffer.from(csv))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('Alice\nBeijing')
  })

  it('指定 contentColumns 时应仅使用指定列作为内容', async () => {
    const loader = new CSVLoader({ contentColumns: ['question'] })
    const csv = 'question,answer\nWhat is AI?,Artificial Intelligence'
    const docs = await loader.load(Buffer.from(csv))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.content).toBe('What is AI?')
  })

  it('应支持自定义分隔符（如 TSV）', async () => {
    const loader = new CSVLoader({ delimiter: '\t' })
    const csv = 'name\tage\nAlice\t30'
    const docs = await loader.load(Buffer.from(csv))

    expect(docs).toHaveLength(1)
    expect(docs[0]!.metadata.name).toBe('Alice')
    expect(docs[0]!.metadata.age).toBe('30')
  })

  it('headerRow 为 false 时应自动生成列名 col_0, col_1, ...', async () => {
    const loader = new CSVLoader({ headerRow: false })
    const csv = 'Alice,30\nBob,25'
    const docs = await loader.load(Buffer.from(csv))

    expect(docs).toHaveLength(2)
    expect(docs[0]!.metadata.col_0).toBe('Alice')
    expect(docs[0]!.metadata.col_1).toBe('30')
    expect(docs[1]!.metadata.col_0).toBe('Bob')
  })

  it('空内容应返回空数组', async () => {
    const loader = new CSVLoader()
    const docs = await loader.load(Buffer.from(''))

    expect(docs).toHaveLength(0)
  })

  it('仅有表头行时应返回空数组（无数据行）', async () => {
    const loader = new CSVLoader()
    const docs = await loader.load(Buffer.from('name,age'))

    expect(docs).toHaveLength(0)
  })

  it('每个文档的元数据应包含正确的 rowIndex', async () => {
    const loader = new CSVLoader()
    const csv = 'col\na\nb\nc'
    const docs = await loader.load(Buffer.from(csv))

    expect(docs[0]!.metadata.rowIndex).toBe(0)
    expect(docs[1]!.metadata.rowIndex).toBe(1)
    expect(docs[2]!.metadata.rowIndex).toBe(2)
  })

  it('应正确处理引号包裹的字段', async () => {
    const loader = new CSVLoader()
    const csv = 'name,desc\nAlice,"Hello, World"\nBob,"He said ""hi"""'
    const docs = await loader.load(Buffer.from(csv))

    expect(docs).toHaveLength(2)
    expect(docs[0]!.metadata.desc).toBe('Hello, World')
    expect(docs[1]!.metadata.desc).toBe('He said "hi"')
  })

  it('元数据应包含 loader 和 format 标识', async () => {
    const loader = new CSVLoader()
    const csv = 'a\n1'
    const docs = await loader.load(Buffer.from(csv))

    expect(docs[0]!.metadata.loader).toBe('CSVLoader')
    expect(docs[0]!.metadata.format).toBe('csv')
  })
})
