import { describe, it, expect } from 'vitest'
import { BaseLoader } from '../../src/loader/base'
import type { Document } from '@rag-sdk/core'

/**
 * 具体子类，用于测试抽象基类 BaseLoader
 */
class ConcreteLoader extends BaseLoader {
  async load(_source: string | Buffer): Promise<Document[]> {
    return []
  }

  /** 暴露 protected 方法供测试调用 */
  public exposeGenerateId(): string {
    return this.generateId()
  }
}

describe('BaseLoader', () => {
  const loader = new ConcreteLoader()

  it('generateId 应返回符合 UUID v4 格式的字符串', () => {
    const id = loader.exposeGenerateId()
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    expect(id).toMatch(uuidV4Regex)
  })

  it('generateId 每次调用应返回不同的值', () => {
    const ids = new Set(Array.from({ length: 10 }, () => loader.exposeGenerateId()))
    expect(ids.size).toBe(10)
  })

  it('子类应能正常实例化并保持 BaseLoader 的类型', () => {
    expect(loader).toBeInstanceOf(BaseLoader)
  })

  it('load 方法应由子类实现并正常返回', async () => {
    const result = await loader.load(Buffer.from('test'))
    expect(result).toEqual([])
  })
})
