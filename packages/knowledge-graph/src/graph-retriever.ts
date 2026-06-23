import { z } from 'zod';
import type { Chunk, LLMProvider, Message, Retriever, RetrieveOptions, SearchResult } from '@rag-sdk/core';
import type { Entity, GraphRetrieverOptions, GraphStore, Relation } from './types';

/** 实体名称提取的 Zod schema */
const EntityNamesSchema = z.object({
  entities: z.array(z.string()).describe('从问题中提取的实体名称列表'),
}).describe('实体识别结果');

/**
 * 图检索器
 *
 * 基于知识图谱进行检索。从用户问题中识别实体，
 * 在图中沿关系链扩展，找到与问题相关的结构化知识。
 *
 * 实现 `@rag-sdk/core` 的 `Retriever` 接口，
 * 将图实体/关系转换为 SearchResult（含合成 Chunk）格式。
 */
export class GraphRetriever implements Retriever {
  private readonly graphStore: GraphStore;
  private readonly llmProvider: LLMProvider;
  private readonly maxHops: number;
  private readonly maxEntities: number;

  /**
   * @param options - 图检索器配置
   * @param options.graphStore - 图存储
   * @param options.llmProvider - LLM 提供商（用于从 query 中提取实体）
   * @param options.maxHops - 最大跳数，默认 2
   * @param options.maxEntities - 每跳最大实体数，默认 10
   */
  constructor(options: GraphRetrieverOptions) {
    this.graphStore = options.graphStore;
    this.llmProvider = options.llmProvider;
    this.maxHops = options.maxHops ?? 2;
    this.maxEntities = options.maxEntities ?? 10;
  }

  /**
   * 基于知识图谱检索
   *
   * 步骤：提取实体名称 → 图中匹配 → 多跳扩展 → 转换为 SearchResult
   *
   * @param query - 用户查询文本
   * @param options - 检索选项
   * @param options.topK - 返回结果数量，默认 5
   * @param options.filter - 元数据过滤条件（暂未使用）
   * @param options.threshold - 最低分数阈值（暂未使用）
   * @returns 检索结果
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    const topK = options?.topK ?? 5;

    // 步骤 1：从 query 中提取实体名称
    const entityNames = await this.extractEntitiesFromQuery(query);
    if (entityNames.length === 0) {
      return [];
    }

    // 步骤 2：在图中查找匹配的实体
    const matchedEntities: Entity[] = [];
    for (const name of entityNames) {
      const queryResult = await this.graphStore.query(name);
      matchedEntities.push(...queryResult.entities);
    }

    if (matchedEntities.length === 0) {
      return [];
    }

    // 步骤 3：从匹配实体出发，进行多跳扩展
    const allEntities: Entity[] = [...matchedEntities];
    const allRelations: Relation[] = [];
    const visitedIds = new Set(matchedEntities.map((e) => e.id));

    for (const entity of matchedEntities) {
      const neighborResult = await this.graphStore.getNeighbors(entity.id, {
        hops: this.maxHops,
        limit: this.maxEntities,
      });

      for (const neighbor of neighborResult.entities) {
        if (!visitedIds.has(neighbor.id)) {
          visitedIds.add(neighbor.id);
          allEntities.push(neighbor);
        }
      }
      allRelations.push(...neighborResult.relations);
    }

    // 步骤 4：转换为 SearchResult 格式
    const results = this.convertToSearchResults(allEntities, allRelations);
    return results.slice(0, topK);
  }

  /**
   * 用 chatJson 从 query 中提取实体名称
   *
   * @param query - 用户查询文本
   * @returns 提取到的实体名称列表，失败时返回空数组
   */
  private async extractEntitiesFromQuery(query: string): Promise<string[]> {
    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个实体识别专家。请从用户的问题中提取所有提到的实体名称。',
      },
      { role: 'user', content: query },
    ];

    try {
      const schema = z.toJSONSchema(EntityNamesSchema);
      const result = await this.llmProvider.chatJson<{ entities: string[] }>(
        messages,
        schema,
        { temperature: 0 },
      );
      return result.entities;
    } catch {
      return [];
    }
  }

  /**
   * 将图查询结果转换为 SearchResult
   *
   * 每个实体及其关联关系生成一个 SearchResult，
   * 内容为结构化的文本描述。
   *
   * @param entities - 检索到的实体列表
   * @param relations - 检索到的关系列表
   * @returns 转换后的检索结果列表（按分数降序）
   */
  private convertToSearchResults(
    entities: Entity[],
    relations: Relation[],
  ): SearchResult[] {
    const results: SearchResult[] = [];

    // 按实体分组关系
    const entityRelationMap = new Map<string, Relation[]>();
    for (const rel of relations) {
      const outRels = entityRelationMap.get(rel.source) ?? [];
      outRels.push(rel);
      entityRelationMap.set(rel.source, outRels);

      const inRels = entityRelationMap.get(rel.target) ?? [];
      inRels.push(rel);
      entityRelationMap.set(rel.target, inRels);
    }

    for (const entity of entities) {
      const entityRelations = entityRelationMap.get(entity.id) ?? [];

      // 构建结构化文本描述
      const relationDescs = entityRelations.map((r) => {
        if (r.source === entity.id) {
          return `${entity.name} --[${r.type}]--> ${this.getEntityNameById(entities, r.target)}`;
        }
        return `${this.getEntityNameById(entities, r.source)} --[${r.type}]--> ${entity.name}`;
      });

      const content = [
        `实体：${entity.name}（类型：${entity.type}）`,
        relationDescs.length > 0 ? `关系：\n${relationDescs.join('\n')}` : '',
      ].filter(Boolean).join('\n');

      // 评分：关系越多，信息越丰富
      const score = Math.min(1, 0.3 + entityRelations.length * 0.1);

      const chunk: Chunk = {
        id: `graph_${entity.id}`,
        documentId: entity.id,
        content,
        metadata: {
          entityType: entity.type,
          entityName: entity.name,
          relationCount: entityRelations.length,
        },
      };

      results.push({
        chunk,
        score,
        source: 'graph',
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * 从实体列表中按 ID 查找名称
   *
   * @param entities - 实体列表
   * @param id - 目标实体 ID
   * @returns 实体名称，未找到时返回 ID 本身
   */
  private getEntityNameById(entities: Entity[], id: string): string {
    return entities.find((e) => e.id === id)?.name ?? id;
  }
}
