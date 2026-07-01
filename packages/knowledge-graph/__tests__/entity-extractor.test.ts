import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Document, LLMProvider } from '@ragsdk/core'
import { EntityExtractor } from '../src/entity-extractor'

/** 创建 mock LLM */
function createMockLLM(): LLMProvider {
  return {
    chat: vi.fn(),
    chatStream: vi.fn(),
    chatJson: vi.fn(),
  }
}

/** 测试用文档 */
const mockDocument: Document = {
  id: 'doc-001',
  content: '张三于2020年创建了ABC科技公司。',
  metadata: { source: 'test' },
}

describe('EntityExtractor', () => {
  let mockLLM: LLMProvider

  beforeEach(() => {
    mockLLM = createMockLLM()
  })

  it('应从文档中提取实体和关系（通过 chatJson）', async () => {
    vi.mocked(mockLLM.chatJson).mockResolvedValue({
      entities: [
        { name: '张三', type: '人物', metadata: { '原文': '张三' } },
        { name: 'ABC科技', type: '组织', metadata: {} },
      ],
      relations: [
        { source: '张三', target: 'ABC科技', type: '创建', metadata: {} },
      ],
    })

    const extractor = new EntityExtractor({ llmProvider: mockLLM })
    const result = await extractor.extract(mockDocument)

    expect(result.entities).toHaveLength(2)
    expect(result.relations).toHaveLength(1)
    expect(result.entities[0]!.name).toBe('张三')
    expect(result.entities[1]!.name).toBe('ABC科技')
    expect(result.relations[0]!.type).toBe('创建')

    // 验证 chatJson 被调用
    expect(mockLLM.chatJson).toHaveBeenCalledTimes(1)
  })

  it('应生成规范化的实体 ID（小写、空格转下划线）', async () => {
    vi.mocked(mockLLM.chatJson).mockResolvedValue({
      entities: [
        { name: 'Hello World', type: '概念', metadata: {} },
        { name: '  TypeScript  ', type: '技术', metadata: {} },
        { name: 'ABC科技', type: '组织', metadata: {} },
      ],
      relations: [],
    })

    const extractor = new EntityExtractor({ llmProvider: mockLLM })
    const result = await extractor.extract(mockDocument)

    expect(result.entities[0]!.id).toBe('entity_hello_world')
    expect(result.entities[1]!.id).toBe('entity_typescript')
    expect(result.entities[2]!.id).toBe('entity_abc科技')
  })

  it('应过滤掉 source 或 target 不存在的无效关系', async () => {
    vi.mocked(mockLLM.chatJson).mockResolvedValue({
      entities: [
        { name: '张三', type: '人物', metadata: {} },
      ],
      relations: [
        { source: '张三', target: '不存在的实体', type: '属于', metadata: {} },
        { source: '不存在A', target: '张三', type: '管理', metadata: {} },
        { source: '张三', target: '张三', type: '自引用', metadata: {} },
      ],
    })

    const extractor = new EntityExtractor({ llmProvider: mockLLM })
    const result = await extractor.extract(mockDocument)

    // 只有 source 和 target 都存在的关系被保留
    expect(result.relations).toHaveLength(1)
    expect(result.relations[0]!.type).toBe('自引用')
  })

  it('应在提供自定义 entityTypes 和 relationTypes 时使用', async () => {
    vi.mocked(mockLLM.chatJson).mockResolvedValue({
      entities: [{ name: 'React', type: '框架', metadata: {} }],
      relations: [],
    })

    const customEntityTypes = ['框架', '语言']
    const customRelationTypes = ['依赖', '替代']

    const extractor = new EntityExtractor({
      llmProvider: mockLLM,
      entityTypes: customEntityTypes,
      relationTypes: customRelationTypes,
    })
    await extractor.extract(mockDocument)

    // 验证传递给 chatJson 的 messages 中包含自定义类型
    const callArgs = vi.mocked(mockLLM.chatJson).mock.calls[0]
    const userMessage = callArgs![0][1]!.content
    expect(userMessage).toContain('框架、语言')
    expect(userMessage).toContain('依赖、替代')
  })

  it('应在 chatJson 失败时抛出错误', async () => {
    vi.mocked(mockLLM.chatJson).mockRejectedValue(
      new Error('LLM 调用失败')
    )

    const extractor = new EntityExtractor({ llmProvider: mockLLM })

    await expect(extractor.extract(mockDocument)).rejects.toThrow('LLM 调用失败')
  })

  it('应在实体和关系的 metadata 中添加 sourceDocumentId', async () => {
    vi.mocked(mockLLM.chatJson).mockResolvedValue({
      entities: [
        { name: '张三', type: '人物', metadata: { extra: 'data' } },
        { name: 'ABC科技', type: '组织', metadata: {} },
      ],
      relations: [
        { source: '张三', target: 'ABC科技', type: '创建', metadata: { note: 'test' } },
      ],
    })

    const extractor = new EntityExtractor({ llmProvider: mockLLM })
    const result = await extractor.extract(mockDocument)

    // 实体 metadata 包含 sourceDocumentId
    expect(result.entities[0]!.metadata.sourceDocumentId).toBe('doc-001')
    expect(result.entities[0]!.metadata.extra).toBe('data')
    expect(result.entities[1]!.metadata.sourceDocumentId).toBe('doc-001')

    // 关系 metadata 包含 sourceDocumentId，且 source/target 为实体 ID
    expect(result.relations[0]!.metadata.sourceDocumentId).toBe('doc-001')
    expect(result.relations[0]!.metadata.note).toBe('test')
    expect(result.relations[0]!.source).toBe('entity_张三')
    expect(result.relations[0]!.target).toBe('entity_abc科技')
  })
})
