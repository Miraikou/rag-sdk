import type {
  Entity,
  GraphQueryResult,
  GraphStore,
  NeighborOptions,
  NeighborResult,
  Relation,
} from './types';

/**
 * 内存图存储
 *
 * 基于邻接表的内存图存储实现，适用于开发调试和中小规模数据。
 * 支持双向遍历（出边 + 入边），BFS 多跳邻居查询，最短路径查找。
 */
export class MemoryGraphStore implements GraphStore {
  /** 实体存储：entityId → Entity */
  private readonly entities = new Map<string, Entity>();

  /** 邻接表：entityId → 出边列表 */
  private readonly outgoingEdges = new Map<string, Relation[]>();

  /** 反向邻接表：entityId → 入边列表 */
  private readonly incomingEdges = new Map<string, Relation[]>();

  /**
   * 批量添加实体
   *
   * 如果实体已存在，合并元数据。
   *
   * @param entities - 待添加的实体列表
   */
  async addEntities(entities: Entity[]): Promise<void> {
    for (const entity of entities) {
      const existing = this.entities.get(entity.id);
      if (existing) {
        existing.metadata = { ...existing.metadata, ...entity.metadata };
      } else {
        this.entities.set(entity.id, { ...entity });
      }
    }
  }

  /**
   * 批量添加关系
   *
   * 同 source + target + type 视为重复，自动去重。
   *
   * @param relations - 待添加的关系列表
   */
  async addRelations(relations: Relation[]): Promise<void> {
    for (const relation of relations) {
      // 添加到出边
      const outEdges = this.outgoingEdges.get(relation.source) ?? [];
      const isDuplicate = outEdges.some(
        (e) => e.target === relation.target && e.type === relation.type,
      );
      if (!isDuplicate) {
        outEdges.push({ ...relation });
        this.outgoingEdges.set(relation.source, outEdges);
      }

      // 添加到入边
      const inEdges = this.incomingEdges.get(relation.target) ?? [];
      if (!isDuplicate) {
        inEdges.push({ ...relation });
        this.incomingEdges.set(relation.target, inEdges);
      }
    }
  }

  /**
   * 根据 ID 获取实体
   *
   * @param entityId - 实体唯一标识
   * @returns 匹配的实体，不存在时返回 null
   */
  async getEntity(entityId: string): Promise<Entity | null> {
    return this.entities.get(entityId) ?? null;
  }

  /**
   * 获取实体的邻居（BFS 多跳遍历）
   *
   * 支持双向遍历（出边 + 入边），可按关系类型和实体类型过滤。
   *
   * @param entityId - 起始实体 ID
   * @param options - 邻居查询选项
   * @param options.hops - 跳数限制，默认 1
   * @param options.limit - 最大返回数量
   * @param options.relationTypes - 关系类型过滤
   * @param options.entityTypes - 实体类型过滤
   * @returns 邻居实体和连接关系的集合
   */
  async getNeighbors(
    entityId: string,
    options?: NeighborOptions,
  ): Promise<NeighborResult> {
    const hops = options?.hops ?? 1;
    const limit = options?.limit ?? Infinity;

    const visitedEntities = new Set<string>();
    const collectedEntities: Entity[] = [];
    const collectedRelations: Relation[] = [];

    let currentLevel = [entityId];
    visitedEntities.add(entityId);

    for (let hop = 0; hop < hops; hop++) {
      const nextLevel: string[] = [];

      for (const id of currentLevel) {
        const outEdges = this.outgoingEdges.get(id) ?? [];
        const inEdges = this.incomingEdges.get(id) ?? [];
        const allEdges = [...outEdges, ...inEdges];

        for (const edge of allEdges) {
          // 关系类型过滤
          if (options?.relationTypes && !options.relationTypes.includes(edge.type)) {
            continue;
          }

          const neighborId = edge.source === id ? edge.target : edge.source;
          if (visitedEntities.has(neighborId)) continue;

          const neighborEntity = this.entities.get(neighborId);
          if (!neighborEntity) continue;

          // 实体类型过滤
          if (options?.entityTypes && !options.entityTypes.includes(neighborEntity.type)) {
            continue;
          }

          visitedEntities.add(neighborId);
          collectedEntities.push(neighborEntity);
          collectedRelations.push(edge);
          nextLevel.push(neighborId);

          if (collectedEntities.length >= limit) {
            return { entities: collectedEntities, relations: collectedRelations };
          }
        }
      }

      currentLevel = nextLevel;
    }

    return { entities: collectedEntities, relations: collectedRelations };
  }

  /**
   * BFS 查找两个实体之间的最短路径
   *
   * @param sourceId - 起始实体 ID
   * @param targetId - 目标实体 ID
   * @returns 路径上的实体序列（含起止），无路径时返回空数组
   */
  async findPath(sourceId: string, targetId: string): Promise<Entity[]> {
    const visited = new Set<string>();
    const parent = new Map<string, string | null>();
    const queue: string[] = [sourceId];

    visited.add(sourceId);
    parent.set(sourceId, null);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === targetId) {
        return this.reconstructPath(parent, targetId);
      }

      const outEdges = this.outgoingEdges.get(current) ?? [];
      const inEdges = this.incomingEdges.get(current) ?? [];

      for (const edge of [...outEdges, ...inEdges]) {
        const neighborId = edge.source === current ? edge.target : edge.source;
        if (visited.has(neighborId)) continue;
        if (!this.entities.has(neighborId)) continue;

        visited.add(neighborId);
        parent.set(neighborId, current);
        queue.push(neighborId);
      }
    }

    return [];
  }

  /**
   * 关键词图查询
   *
   * 简单的关键词匹配实现，匹配实体名称和类型。
   *
   * @param queryText - 查询文本（空格分隔的多关键词）
   * @returns 匹配的实体、关系和路径
   */
  async query(queryText: string): Promise<GraphQueryResult> {
    const keywords = queryText.toLowerCase().split(/\s+/);
    const matchedEntities: Entity[] = [];
    const matchedRelations: Relation[] = [];

    for (const entity of this.entities.values()) {
      const nameMatch = keywords.some((kw) =>
        entity.name.toLowerCase().includes(kw),
      );
      const typeMatch = keywords.some((kw) =>
        entity.type.toLowerCase().includes(kw),
      );
      if (nameMatch || typeMatch) {
        matchedEntities.push(entity);
      }
    }

    // 收集匹配实体之间的关系
    const matchedEntityIds = new Set(matchedEntities.map((e) => e.id));
    for (const edges of this.outgoingEdges.values()) {
      for (const edge of edges) {
        if (matchedEntityIds.has(edge.source) && matchedEntityIds.has(edge.target)) {
          matchedRelations.push(edge);
        }
      }
    }

    return { entities: matchedEntities, relations: matchedRelations, paths: [] };
  }

  /**
   * 获取存储统计信息
   *
   * @returns 实体数量和关系数量
   */
  getStats(): { entityCount: number; relationCount: number } {
    let relationCount = 0;
    for (const edges of this.outgoingEdges.values()) {
      relationCount += edges.length;
    }
    return { entityCount: this.entities.size, relationCount };
  }

  /**
   * 回溯 BFS 路径
   *
   * @param parent - BFS 遍历中的父节点映射表
   * @param targetId - 目标实体 ID
   * @returns 从起点到目标的实体路径
   */
  private reconstructPath(
    parent: Map<string, string | null>,
    targetId: string,
  ): Entity[] {
    const path: Entity[] = [];
    let current: string | null = targetId;

    while (current !== null) {
      const entity = this.entities.get(current);
      if (entity) {
        path.unshift(entity);
      }
      current = parent.get(current) ?? null;
    }

    return path;
  }
}

/**
 * Neo4j 图数据库适配器（接口预留）
 *
 * 生产环境可接入 Neo4j 实现持久化和高性能图查询。
 * 当前版本所有方法均抛出未实现错误。
 */
export class Neo4jGraphStore implements GraphStore {
  /**
   * @param _config - Neo4j 连接配置（预留）
   */
  constructor(_config: { uri: string; username: string; password: string; database?: string }) {
    throw new Error('Neo4jGraphStore 尚未实现，请使用 MemoryGraphStore');
  }

  async addEntities(_entities: Entity[]): Promise<void> {
    throw new Error('未实现');
  }

  async addRelations(_relations: Relation[]): Promise<void> {
    throw new Error('未实现');
  }

  async getEntity(_entityId: string): Promise<Entity | null> {
    throw new Error('未实现');
  }

  async getNeighbors(_entityId: string, _options?: NeighborOptions): Promise<NeighborResult> {
    throw new Error('未实现');
  }

  async findPath(_sourceId: string, _targetId: string): Promise<Entity[]> {
    throw new Error('未实现');
  }

  async query(_queryText: string): Promise<GraphQueryResult> {
    throw new Error('未实现');
  }
}
