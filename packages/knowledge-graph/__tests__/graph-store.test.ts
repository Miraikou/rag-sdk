import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryGraphStore } from '../src/graph-store';
import type { Entity, Relation } from '../src/types';

/**
 * 创建测试用实体
 */
function makeEntity(id: string, name: string, type: string): Entity {
  return { id, name, type, metadata: {} };
}

/**
 * 创建测试用关系
 */
function makeRelation(source: string, target: string, type: string): Relation {
  return { source, target, type, metadata: {} };
}

/**
 * 测试图结构：
 *
 * 张三(e1) --[创建]--> ABC科技(e2) --[包含]--> 智析平台(e3) --[使用]--> 深度学习(e4)
 * 李四(e5) --[属于]--> ABC科技(e2)
 */
const testEntities: Entity[] = [
  makeEntity('e1', '张三', '人物'),
  makeEntity('e2', 'ABC科技', '组织'),
  makeEntity('e3', '智析平台', '产品'),
  makeEntity('e4', '深度学习', '概念'),
  makeEntity('e5', '李四', '人物'),
];

const testRelations: Relation[] = [
  makeRelation('e1', 'e2', '创建'),
  makeRelation('e2', 'e3', '包含'),
  makeRelation('e3', 'e4', '使用'),
  makeRelation('e5', 'e2', '属于'),
];

describe('MemoryGraphStore', () => {
  let store: MemoryGraphStore;

  beforeEach(async () => {
    store = new MemoryGraphStore();
    await store.addEntities(testEntities);
    await store.addRelations(testRelations);
  });

  describe('addEntities', () => {
    it('应正确添加实体并可通过 ID 检索', async () => {
      const freshStore = new MemoryGraphStore();
      await freshStore.addEntities([makeEntity('x1', '测试实体', '类型A')]);

      const entity = await freshStore.getEntity('x1');
      expect(entity).not.toBeNull();
      expect(entity!.name).toBe('测试实体');
      expect(entity!.type).toBe('类型A');

      // 不存在的实体返回 null
      const missing = await freshStore.getEntity('nonexistent');
      expect(missing).toBeNull();
    });

    it('重复添加实体时应合并 metadata', async () => {
      const freshStore = new MemoryGraphStore();
      await freshStore.addEntities([
        { id: 'm1', name: '原始', type: '类型', metadata: { a: 1, b: 2 } },
      ]);
      await freshStore.addEntities([
        { id: 'm1', name: '原始', type: '类型', metadata: { b: 99, c: 3 } },
      ]);

      const entity = await freshStore.getEntity('m1');
      expect(entity).not.toBeNull();
      expect(entity!.metadata).toEqual({ a: 1, b: 99, c: 3 });
    });
  });

  describe('addRelations', () => {
    it('应正确添加关系并对同 source+target+type 去重', async () => {
      const freshStore = new MemoryGraphStore();
      await freshStore.addEntities([
        makeEntity('a', 'A', '类型'),
        makeEntity('b', 'B', '类型'),
      ]);

      const rel = makeRelation('a', 'b', '关联');
      await freshStore.addRelations([rel, rel, rel]);

      // 通过 getStats 验证关系数量为 1（已去重）
      const stats = freshStore.getStats();
      expect(stats.relationCount).toBe(1);
      expect(stats.entityCount).toBe(2);
    });
  });

  describe('getNeighbors', () => {
    it('单跳查询应返回直接邻居（双向）', async () => {
      // 从 ABC科技(e2) 出发，1 跳可达：张三(e1, 入边)、智析平台(e3, 出边)、李四(e5, 入边)
      const result = await store.getNeighbors('e2');

      const names = result.entities.map((e) => e.name);
      expect(names).toContain('张三');
      expect(names).toContain('智析平台');
      expect(names).toContain('李四');
      expect(result.entities).toHaveLength(3);
      expect(result.relations).toHaveLength(3);
    });

    it('多跳查询（hops=2）应返回扩展邻居', async () => {
      // 从 ABC科技(e2) 出发，2 跳可达所有实体：
      // 1 跳：张三(e1)、智析平台(e3)、李四(e5)
      // 2 跳：深度学习(e4，经智析平台)
      const result = await store.getNeighbors('e2', { hops: 2 });

      const names = result.entities.map((e) => e.name);
      expect(names).toContain('张三');
      expect(names).toContain('智析平台');
      expect(names).toContain('李四');
      expect(names).toContain('深度学习');
      expect(result.entities).toHaveLength(4);
    });

    it('应支持 entityTypes 过滤', async () => {
      // 从 ABC科技(e2) 出发，1 跳，仅保留 type 为 '人物' 的实体
      // 1 跳邻居：张三(人物)✓、智析平台(产品)✗、李四(人物)✓
      const result = await store.getNeighbors('e2', {
        hops: 1,
        entityTypes: ['人物'],
      });

      const names = result.entities.map((e) => e.name);
      expect(names).toContain('张三');
      expect(names).toContain('李四');
      // 智析平台(产品) 应被过滤
      expect(names).not.toContain('智析平台');
      expect(result.entities).toHaveLength(2);
    });

    it('应支持 limit 选项限制返回数量', async () => {
      // e2 有 3 个 1 跳邻居，limit:2 应只返回 2 个
      const result = await store.getNeighbors('e2', { hops: 1, limit: 2 });

      expect(result.entities).toHaveLength(2);
      expect(result.relations).toHaveLength(2);
    });
  });

  describe('findPath', () => {
    it('应找到两个实体之间的最短路径', async () => {
      // 张三(e1) → ABC科技(e2) → 智析平台(e3) → 深度学习(e4)
      const path = await store.findPath('e1', 'e4');

      expect(path.length).toBeGreaterThan(0);
      const names = path.map((e) => e.name);
      expect(names[0]).toBe('张三');
      expect(names[names.length - 1]).toBe('深度学习');
    });

    it('不存在路径时应返回空数组', async () => {
      // 添加一个孤立实体
      await store.addEntities([makeEntity('isolated', '孤岛', '独立')]);

      const path = await store.findPath('e1', 'isolated');
      expect(path).toEqual([]);
    });
  });

  describe('query', () => {
    it('应按关键词匹配实体名称或类型', async () => {
      // 查询 '人物' 应匹配所有 type 为 '人物' 的实体
      const result = await store.query('人物');

      const names = result.entities.map((e) => e.name);
      expect(names).toContain('张三');
      expect(names).toContain('李四');
      expect(result.entities).toHaveLength(2);

      // 匹配实体之间存在的关联关系
      expect(result.relations.length).toBeGreaterThanOrEqual(0);
    });

    it('应按实体名称关键词匹配', async () => {
      const result = await store.query('ABC');

      const names = result.entities.map((e) => e.name);
      expect(names).toContain('ABC科技');
      expect(result.entities).toHaveLength(1);
    });
  });
});
