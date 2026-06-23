import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Retriever, SearchResult } from '@rag-sdk/core';
import { GraphEnhancedRetriever } from '../src/graph-enhanced-retriever';
import { MemoryGraphStore } from '../src/graph-store';
import type { Entity, GraphRetrieverLike, Relation } from '../src/types';

describe('GraphEnhancedRetriever', () => {
  let graphStore: MemoryGraphStore;
  let mockVectorRetriever: Retriever;
  let mockGraphRetriever: GraphRetrieverLike;
  let retriever: GraphEnhancedRetriever;

  /** 测试用实体 */
  const entities: Entity[] = [
    { id: 'e_zhangsan', name: '张三', type: '人物', metadata: {} },
    { id: 'e_abc', name: 'ABC科技', type: '组织', metadata: {} },
    { id: 'e_product', name: '智能机器人', type: '产品', metadata: {} },
  ];

  /** 测试用关系 */
  const relations: Relation[] = [
    { source: 'e_zhangsan', target: 'e_abc', type: '就职于', metadata: {} },
    { source: 'e_abc', target: 'e_product', type: '研发', metadata: {} },
  ];

  /** 向量检索结果 */
  const vectorResults: SearchResult[] = [
    {
      chunk: { id: 'c1', documentId: 'd1', content: '张三在ABC科技担任CTO', metadata: {} },
      score: 0.9,
      source: 'vector',
    },
    {
      chunk: { id: 'c2', documentId: 'd2', content: 'ABC科技发布了智能机器人', metadata: {} },
      score: 0.7,
      source: 'vector',
    },
  ];

  /** 图检索结果 */
  const graphResults: SearchResult[] = [
    {
      chunk: {
        id: 'graph_e_zhangsan',
        documentId: 'e_zhangsan',
        content: '实体：张三（类型：人物）\n关系：\n张三 --[就职于]--> ABC科技',
        metadata: { entityType: '人物', entityName: '张三', relationCount: 1 },
      },
      score: 0.4,
      source: 'graph',
    },
    {
      chunk: {
        id: 'graph_e_abc',
        documentId: 'e_abc',
        content: '实体：ABC科技（类型：组织）\n关系：\n张三 --[就职于]--> ABC科技\nABC科技 --[研发]--> 智能机器人',
        metadata: { entityType: '组织', entityName: 'ABC科技', relationCount: 2 },
      },
      score: 0.5,
      source: 'graph',
    },
  ];

  beforeEach(async () => {
    graphStore = new MemoryGraphStore();
    await graphStore.addEntities(entities);
    await graphStore.addRelations(relations);

    mockVectorRetriever = {
      retrieve: vi.fn().mockResolvedValue(vectorResults),
    };

    mockGraphRetriever = {
      retrieve: vi.fn().mockResolvedValue(graphResults),
    };

    retriever = new GraphEnhancedRetriever({
      vectorRetriever: mockVectorRetriever,
      graphRetriever: mockGraphRetriever,
      graphStore,
      vectorWeight: 0.6,
      graphWeight: 0.4,
      topK: 5,
    });
  });

  it('应将向量和图结果加权合并并排序', async () => {
    const results = await retriever.retrieve('张三在ABC科技做什么');

    // 两个检索器都应被调用
    expect(mockVectorRetriever.retrieve).toHaveBeenCalledTimes(1);
    expect(mockGraphRetriever.retrieve).toHaveBeenCalledTimes(1);

    // 应有结果返回
    expect(results.length).toBeGreaterThan(0);

    // 结果应按分数降序排列
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }

    // 向量结果分数应乘以 0.6 权重
    // c1: 归一化 (0.9/0.9) * 0.6 = 0.6
    const c1Result = results.find((r) => r.chunk.id === 'c1');
    expect(c1Result).toBeDefined();
    expect(c1Result!.score).toBeCloseTo(0.6, 5);
  });

  it('当向量检索无结果时应仅返回图检索结果', async () => {
    vi.mocked(mockVectorRetriever.retrieve).mockResolvedValueOnce([]);

    const results = await retriever.retrieve('张三的信息');

    // 应返回图检索结果（加权后）
    expect(results.length).toBeGreaterThan(0);

    // 所有结果应来自图
    for (const result of results) {
      expect(result.source).toBe('graph');
    }
  });

  it('当图检索无结果时应仅返回向量检索结果', async () => {
    vi.mocked(mockGraphRetriever.retrieve).mockResolvedValueOnce([]);

    const results = await retriever.retrieve('张三的信息');

    // 应返回向量结果（加权后）
    expect(results.length).toBeGreaterThan(0);

    // 所有结果应来自向量
    for (const result of results) {
      expect(result.source).toBe('vector');
    }
  });

  it('应对同时出现在向量和图结果中的相同 chunk 去重并累加分数', async () => {
    // 让图检索返回与向量检索相同 chunk ID 的结果
    const duplicateGraphResults: SearchResult[] = [
      {
        chunk: { id: 'c1', documentId: 'd1', content: '张三在ABC科技担任CTO', metadata: {} },
        score: 0.8,
        source: 'graph',
      },
    ];
    vi.mocked(mockGraphRetriever.retrieve).mockResolvedValueOnce(duplicateGraphResults);

    const results = await retriever.retrieve('张三在ABC科技做什么');

    // c1 应只出现一次
    const c1Results = results.filter((r) => r.chunk.id === 'c1');
    expect(c1Results).toHaveLength(1);

    // c1 的分数应为向量分数 + 图分数
    // 向量：(0.9/0.9) * 0.6 = 0.6
    // 图：(0.8/0.8) * 0.4 = 0.4
    // 合计：1.0
    expect(c1Results[0]!.score).toBeCloseTo(1.0, 5);
  });
});
