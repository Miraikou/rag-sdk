import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMProvider } from '@rag-sdk/core';
import { GraphRetriever } from '../src/graph-retriever';
import { MemoryGraphStore } from '../src/graph-store';
import type { Entity, Relation } from '../src/types';

describe('GraphRetriever', () => {
  let graphStore: MemoryGraphStore;
  let mockLLM: LLMProvider;
  let retriever: GraphRetriever;

  /** 测试用实体 */
  const entities: Entity[] = [
    { id: 'e_zhangsan', name: '张三', type: '人物', metadata: {} },
    { id: 'e_abc', name: 'ABC科技', type: '组织', metadata: {} },
    { id: 'e_product', name: '智能机器人', type: '产品', metadata: {} },
    { id: 'e_beijing', name: '北京', type: '地点', metadata: {} },
  ];

  /** 测试用关系 */
  const relations: Relation[] = [
    { source: 'e_zhangsan', target: 'e_abc', type: '就职于', metadata: {} },
    { source: 'e_abc', target: 'e_product', type: '研发', metadata: {} },
    { source: 'e_abc', target: 'e_beijing', type: '位于', metadata: {} },
  ];

  beforeEach(async () => {
    graphStore = new MemoryGraphStore();
    await graphStore.addEntities(entities);
    await graphStore.addRelations(relations);

    mockLLM = {
      chat: vi.fn(),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockResolvedValue({ entities: ['张三', 'ABC科技'] }),
    };

    retriever = new GraphRetriever({
      graphStore,
      llmProvider: mockLLM,
      maxHops: 2,
      maxEntities: 10,
    });
  });

  it('应通过 chatJson 从查询中提取实体并返回图检索结果', async () => {
    const results = await retriever.retrieve('张三在ABC科技工作');

    // 验证 chatJson 被调用
    expect(mockLLM.chatJson).toHaveBeenCalledTimes(1);

    // 应该返回结果
    expect(results.length).toBeGreaterThan(0);

    // 结果中应包含匹配到的实体
    const entityNames = results.map((r) => r.chunk.metadata['entityName']);
    expect(entityNames).toContain('张三');
    expect(entityNames).toContain('ABC科技');
  });

  it('当查询中未提取到实体时应返回空结果', async () => {
    // chatJson 返回空实体列表
    vi.mocked(mockLLM.chatJson).mockResolvedValueOnce({ entities: [] });

    const results = await retriever.retrieve('今天天气怎么样');
    expect(results).toEqual([]);
  });

  it('当提取的实体在图中不存在时应返回空结果', async () => {
    // chatJson 返回图中不存在的实体
    vi.mocked(mockLLM.chatJson).mockResolvedValueOnce({ entities: ['不存在的人', '虚构的公司'] });

    const results = await retriever.retrieve('不存在的人创立了虚构的公司');
    expect(results).toEqual([]);
  });

  it('应从匹配实体进行多跳扩展', async () => {
    // 只提取「张三」一个实体，但通过多跳扩展应能找到关联实体
    vi.mocked(mockLLM.chatJson).mockResolvedValueOnce({ entities: ['张三'] });

    const results = await retriever.retrieve('张三的信息');

    // 匹配实体为张三，扩展后应包含邻居实体（ABC科技、智能机器人、北京）
    const entityNames = results.map((r) => r.chunk.metadata['entityName']);
    expect(entityNames).toContain('张三');
    // 多跳扩展应发现 ABC科技（张三的直接邻居）
    expect(entityNames).toContain('ABC科技');
  });

  it('应将图结果转换为 SearchResult 格式且 source 为 graph', async () => {
    const results = await retriever.retrieve('张三在ABC科技工作');

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      // source 应为 graph
      expect(result.source).toBe('graph');

      // chunk 结构完整
      expect(result.chunk.id).toMatch(/^graph_/);
      expect(result.chunk.documentId).toBeDefined();
      expect(result.chunk.content).toBeDefined();
      expect(typeof result.chunk.content).toBe('string');

      // 分数合理
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);

      // metadata 包含实体信息
      expect(result.chunk.metadata['entityType']).toBeDefined();
      expect(result.chunk.metadata['entityName']).toBeDefined();
      expect(typeof result.chunk.metadata['relationCount']).toBe('number');
    }
  });
});
