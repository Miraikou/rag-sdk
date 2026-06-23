import type { Document, Entity, GraphData, Relation, GraphBuilderOptions, BuildReport } from './types';

/**
 * 图构建器
 *
 * 从文档批量构建知识图谱的完整流水线。
 * 协调实体抽取、去重合并、存储入库等步骤，并生成构建报告。
 *
 * 工作流程：文档列表 → 逐文档抽取 → 实体去重合并 → 关系去重 → 存入 GraphStore
 */
export class GraphBuilder {
  private readonly extractor: GraphBuilderOptions['extractor'];
  private readonly graphStore: GraphBuilderOptions['graphStore'];
  private readonly concurrency: number;
  private readonly timeoutMs: number;

  /**
   * @param options - 图构建器配置
   * @param options.extractor - 实体关系抽取器
   * @param options.graphStore - 图存储
   * @param options.concurrency - 并发数，默认 3
   * @param options.timeoutMs - 单文档超时时间（毫秒），默认 30000
   */
  constructor(options: GraphBuilderOptions) {
    this.extractor = options.extractor;
    this.graphStore = options.graphStore;
    this.concurrency = options.concurrency ?? 3;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  /**
   * 从文档列表批量构建知识图谱
   *
   * @param documents - 文档列表
   * @returns 构建报告
   */
  async buildFromDocuments(documents: Document[]): Promise<BuildReport> {
    const startTime = Date.now();
    const errors: string[] = [];
    const perDocument: BuildReport['perDocument'] = [];

    const allEntities: Entity[] = [];
    const allRelations: Relation[] = [];

    // 分批并发处理
    for (let i = 0; i < documents.length; i += this.concurrency) {
      const batch = documents.slice(i, i + this.concurrency);

      const batchResults = await Promise.allSettled(
        batch.map((doc) => this.extractWithTimeout(doc)),
      );

      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j]!;
        const result = batchResults[j]!;

        if (result.status === 'fulfilled') {
          const graphData = result.value;
          allEntities.push(...graphData.entities);
          allRelations.push(...graphData.relations);
          perDocument.push({
            documentId: doc.id,
            entityCount: graphData.entities.length,
            relationCount: graphData.relations.length,
          });
        } else {
          const errorMsg = `文档 ${doc.id} 抽取失败: ${String(result.reason)}`;
          errors.push(errorMsg);
          perDocument.push({
            documentId: doc.id,
            entityCount: 0,
            relationCount: 0,
            error: errorMsg,
          });
        }
      }
    }

    // 实体去重合并
    const mergedEntities = this.mergeEntities(allEntities);

    // 关系去重
    const mergedRelations = this.deduplicateRelations(allRelations);

    // 存入 GraphStore
    try {
      await this.graphStore.addEntities(mergedEntities);
      await this.graphStore.addRelations(mergedRelations);
    } catch (err) {
      const msg = `存入图存储失败: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
    }

    return {
      entityCount: mergedEntities.length,
      relationCount: mergedRelations.length,
      documentCount: documents.length,
      errors,
      perDocument,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 带超时的抽取
   *
   * @param doc - 待抽取的文档
   * @returns 抽取的图数据
   * @throws 抽取超时时抛出错误
   */
  private async extractWithTimeout(doc: Document): Promise<GraphData> {
    return Promise.race([
      this.extractor.extract(doc),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`抽取超时（${this.timeoutMs}ms）`)), this.timeoutMs),
      ),
    ]);
  }

  /**
   * 实体去重与合并
   *
   * 同 ID 的实体合并元数据，保留最新的类型信息。
   *
   * @param entities - 待去重的实体列表（可能包含跨文档重复）
   * @returns 去重后的实体列表
   */
  private mergeEntities(entities: Entity[]): Entity[] {
    const entityMap = new Map<string, Entity>();

    for (const entity of entities) {
      const existing = entityMap.get(entity.id);
      if (existing) {
        existing.metadata = { ...existing.metadata, ...entity.metadata };
      } else {
        entityMap.set(entity.id, { ...entity });
      }
    }

    return Array.from(entityMap.values());
  }

  /**
   * 关系去重
   *
   * 同 source + target + type 视为重复，合并元数据。
   *
   * @param relations - 待去重的关系列表
   * @returns 去重后的关系列表
   */
  private deduplicateRelations(relations: Relation[]): Relation[] {
    const relationMap = new Map<string, Relation>();

    for (const relation of relations) {
      const key = `${relation.source}::${relation.target}::${relation.type}`;
      const existing = relationMap.get(key);
      if (existing) {
        existing.metadata = { ...existing.metadata, ...relation.metadata };
      } else {
        relationMap.set(key, { ...relation });
      }
    }

    return Array.from(relationMap.values());
  }
}
