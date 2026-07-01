import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Document } from '@ragsdk/core';
import { GraphBuilder } from '../src/graph-builder';
import { MemoryGraphStore } from '../src/graph-store';
import type { EntityExtractorLike, GraphData } from '../src/types';

describe('GraphBuilder', () => {
  let graphStore: MemoryGraphStore;
  let mockExtractor: EntityExtractorLike;
  let builder: GraphBuilder;

  /** 测试用文档 */
  const documents: Document[] = [
    { id: 'doc1', content: '张三是ABC科技的创始人', metadata: {} },
    { id: 'doc2', content: 'ABC科技位于北京，研发了智能机器人', metadata: {} },
  ];

  beforeEach(() => {
    graphStore = new MemoryGraphStore();

    mockExtractor = {
      extract: vi.fn(),
    };

    builder = new GraphBuilder({
      extractor: mockExtractor,
      graphStore,
      concurrency: 3,
      timeoutMs: 5000,
    });
  });

  it('应从文档中提取实体和关系并存入图存储', async () => {
    // 第一个文档的抽取结果
    const doc1Result: GraphData = {
      entities: [
        { id: 'e_zhangsan', name: '张三', type: '人物', metadata: {} },
        { id: 'e_abc', name: 'ABC科技', type: '组织', metadata: {} },
      ],
      relations: [
        { source: 'e_zhangsan', target: 'e_abc', type: '创始人', metadata: {} },
      ],
    };

    // 第二个文档的抽取结果
    const doc2Result: GraphData = {
      entities: [
        { id: 'e_abc', name: 'ABC科技', type: '组织', metadata: {} },
        { id: 'e_beijing', name: '北京', type: '地点', metadata: {} },
        { id: 'e_product', name: '智能机器人', type: '产品', metadata: {} },
      ],
      relations: [
        { source: 'e_abc', target: 'e_beijing', type: '位于', metadata: {} },
        { source: 'e_abc', target: 'e_product', type: '研发', metadata: {} },
      ],
    };

    vi.mocked(mockExtractor.extract)
      .mockResolvedValueOnce(doc1Result)
      .mockResolvedValueOnce(doc2Result);

    const report = await builder.buildFromDocuments(documents);

    // 验证报告
    expect(report.documentCount).toBe(2);
    expect(report.errors).toHaveLength(0);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);

    // 实体应去重合并（ABC科技 在两个文档中都出现）
    // doc1: 张三、ABC科技 → 2 个
    // doc2: ABC科技、北京、智能机器人 → 3 个
    // 去重后：张三、ABC科技、北京、智能机器人 → 4 个
    expect(report.entityCount).toBe(4);

    // 关系：创始人 + 位于 + 研发 → 3 条
    expect(report.relationCount).toBe(3);

    // 验证图存储中确实有数据
    const stats = graphStore.getStats();
    expect(stats.entityCount).toBe(4);
    expect(stats.relationCount).toBe(3);

    // 验证 perDocument 统计
    expect(report.perDocument).toHaveLength(2);
    expect(report.perDocument[0]!.documentId).toBe('doc1');
    expect(report.perDocument[0]!.entityCount).toBe(2);
    expect(report.perDocument[1]!.documentId).toBe('doc2');
    expect(report.perDocument[1]!.entityCount).toBe(3);
  });

  it('应跨文档合并重复实体的元数据', async () => {
    const doc1Result: GraphData = {
      entities: [
        { id: 'e_abc', name: 'ABC科技', type: '组织', metadata: { source: 'doc1' } },
      ],
      relations: [],
    };

    const doc2Result: GraphData = {
      entities: [
        { id: 'e_abc', name: 'ABC科技', type: '组织', metadata: { city: '北京' } },
      ],
      relations: [],
    };

    vi.mocked(mockExtractor.extract)
      .mockResolvedValueOnce(doc1Result)
      .mockResolvedValueOnce(doc2Result);

    const report = await builder.buildFromDocuments(documents);

    // 实体去重后只有 1 个
    expect(report.entityCount).toBe(1);

    // 验证图存储中的实体元数据已合并
    const entity = await graphStore.getEntity('e_abc');
    expect(entity).not.toBeNull();
    expect(entity!.metadata['source']).toBe('doc1');
    expect(entity!.metadata['city']).toBe('北京');
  });

  it('应对同 source+target+type 的关系去重', async () => {
    const duplicateRelation = {
      source: 'e_zhangsan',
      target: 'e_abc',
      type: '创始人',
      metadata: {},
    };

    const doc1Result: GraphData = {
      entities: [
        { id: 'e_zhangsan', name: '张三', type: '人物', metadata: {} },
        { id: 'e_abc', name: 'ABC科技', type: '组织', metadata: {} },
      ],
      relations: [{ ...duplicateRelation }],
    };

    const doc2Result: GraphData = {
      entities: [
        { id: 'e_zhangsan', name: '张三', type: '人物', metadata: {} },
        { id: 'e_abc', name: 'ABC科技', type: '组织', metadata: {} },
      ],
      relations: [{ ...duplicateRelation, metadata: { confirmed: true } }],
    };

    vi.mocked(mockExtractor.extract)
      .mockResolvedValueOnce(doc1Result)
      .mockResolvedValueOnce(doc2Result);

    const report = await builder.buildFromDocuments(documents);

    // 重复关系应去重为 1 条
    expect(report.relationCount).toBe(1);

    // 实体去重后 2 个
    expect(report.entityCount).toBe(2);
  });

  it('应在抽取失败时记录错误并继续处理其他文档', async () => {
    const doc1Result: GraphData = {
      entities: [{ id: 'e_zhangsan', name: '张三', type: '人物', metadata: {} }],
      relations: [],
    };

    // 第一个文档成功，第二个文档失败
    vi.mocked(mockExtractor.extract)
      .mockResolvedValueOnce(doc1Result)
      .mockRejectedValueOnce(new Error('LLM 调用失败'));

    const report = await builder.buildFromDocuments(documents);

    // 应有 1 个错误
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain('doc2');
    expect(report.errors[0]).toContain('LLM 调用失败');

    // 第二个文档的 perDocument 应有 error 字段
    expect(report.perDocument[1]!.error).toBeDefined();
    expect(report.perDocument[1]!.entityCount).toBe(0);

    // 第一个文档的实体应正常存入
    expect(report.entityCount).toBe(1);
    const entity = await graphStore.getEntity('e_zhangsan');
    expect(entity).not.toBeNull();
    expect(entity!.name).toBe('张三');
  });

  it('应按并发限制分批处理文档', async () => {
    // 设置并发数为 2
    builder = new GraphBuilder({
      extractor: mockExtractor,
      graphStore,
      concurrency: 2,
    });

    const docs: Document[] = [
      { id: 'd1', content: '内容1', metadata: {} },
      { id: 'd2', content: '内容2', metadata: {} },
      { id: 'd3', content: '内容3', metadata: {} },
      { id: 'd4', content: '内容4', metadata: {} },
      { id: 'd5', content: '内容5', metadata: {} },
    ];

    // 跟踪并发数
    let currentConcurrent = 0;
    let maxConcurrent = 0;

    vi.mocked(mockExtractor.extract).mockImplementation(async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      // 模拟异步延迟
      await new Promise((resolve) => setTimeout(resolve, 10));
      currentConcurrent--;
      return { entities: [], relations: [] };
    });

    await builder.buildFromDocuments(docs);

    // 最大并发数不应超过 2
    expect(maxConcurrent).toBeLessThanOrEqual(2);

    // 所有 5 个文档都应被处理
    expect(mockExtractor.extract).toHaveBeenCalledTimes(5);
  });
});
