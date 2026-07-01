import type { Retriever, RetrieveOptions, SearchResult } from '@ragsdk/core';
import type { GraphEnhancedRetrieverOptions, GraphStore } from './types';

/**
 * 图增强检索器（混合检索）
 *
 * 同时利用向量检索（语义相似）和图检索（结构化推理）的优势，
 * 将两者的结果归一化加权合并后返回。
 *
 * 工作流程：
 * 1. 并行执行向量检索和图检索
 * 2. 从向量结果中匹配已知实体，进行图扩展
 * 3. 归一化分数，加权合并
 */
export class GraphEnhancedRetriever implements Retriever {
  private readonly vectorRetriever: Retriever;
  private readonly graphRetriever: Retriever;
  private readonly graphStore: GraphStore;
  private readonly vectorWeight: number;
  private readonly graphWeight: number;
  private readonly topK: number;

  /**
   * @param options - 图增强检索器配置
   * @param options.vectorRetriever - 向量检索器
   * @param options.graphRetriever - 图检索器
   * @param options.graphStore - 图存储（用于从 chunk 中提取实体进行图扩展）
   * @param options.vectorWeight - 向量结果权重，默认 0.6
   * @param options.graphWeight - 图结果权重，默认 0.4
   * @param options.topK - 最终返回数量，默认 5
   */
  constructor(options: GraphEnhancedRetrieverOptions) {
    this.vectorRetriever = options.vectorRetriever;
    this.graphRetriever = options.graphRetriever;
    this.graphStore = options.graphStore;
    this.vectorWeight = options.vectorWeight ?? 0.6;
    this.graphWeight = options.graphWeight ?? 0.4;
    this.topK = options.topK ?? 5;
  }

  /**
   * 混合检索
   *
   * @param query - 用户查询
   * @param options - 检索选项
   * @param options.topK - 返回结果数量，默认使用构造器配置
   * @param options.filter - 元数据过滤条件（暂未使用）
   * @param options.threshold - 最低分数阈值（暂未使用）
   * @returns 合并排序后的检索结果
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    const topK = options?.topK ?? this.topK;

    // 步骤 1：并行执行向量检索和图检索
    const [vectorResults, graphResults] = await Promise.all([
      this.vectorRetriever.retrieve(query, { topK: topK * 2 }),
      this.graphRetriever.retrieve(query, { topK: topK * 2 }),
    ]);

    // 步骤 2：从向量检索结果中提取实体，进行图扩展
    const expandedGraphResults = await this.expandFromVectorResults(vectorResults);

    // 步骤 3：合并图检索结果和扩展结果（去重）
    const allGraphResults = this.mergeAndDeduplicate([
      ...graphResults,
      ...expandedGraphResults,
    ]);

    // 步骤 4：加权合并
    const mergedResults = this.mergeResults(vectorResults, allGraphResults);
    return mergedResults.slice(0, topK);
  }

  /**
   * 从向量检索的 chunk 中匹配已知实体，在知识图谱中扩展
   *
   * @param vectorResults - 向量检索结果列表
   * @returns 图扩展产生的额外检索结果
   */
  private async expandFromVectorResults(
    vectorResults: SearchResult[],
  ): Promise<SearchResult[]> {
    const expandedResults: SearchResult[] = [];

    for (const result of vectorResults) {
      // 尝试从 chunk 内容中匹配已知实体
      const queryResult = await this.graphStore.query(result.chunk.content);

      for (const entity of queryResult.entities) {
        const neighbors = await this.graphStore.getNeighbors(entity.id, {
          hops: 1,
          limit: 5,
        });

        if (neighbors.entities.length > 0) {
          const content = [
            `实体：${entity.name}（类型：${entity.type}）`,
            `关联实体：${neighbors.entities.map((e) => e.name).join('、')}`,
          ].join('\n');

          expandedResults.push({
            chunk: {
              id: `graph_expanded_${entity.id}`,
              documentId: entity.id,
              content,
              metadata: {
                entityType: entity.type,
                entityName: entity.name,
              },
            },
            score: result.score * 0.8,
            source: 'graph',
          });
        }
      }
    }

    return expandedResults;
  }

  /**
   * 合并并去重结果
   *
   * @param results - 待去重的检索结果列表
   * @returns 按 chunk ID 去重后的结果列表
   */
  private mergeAndDeduplicate(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const result of results) {
      if (!seen.has(result.chunk.id)) {
        seen.add(result.chunk.id);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  /**
   * 加权合并向量结果和图结果
   *
   * 对两路分数分别归一化后按权重加权，同一 chunk 出现在两路时分数累加。
   *
   * @param vectorResults - 向量检索结果
   * @param graphResults - 图检索结果
   * @returns 合并后按分数降序排列的检索结果
   */
  private mergeResults(
    vectorResults: SearchResult[],
    graphResults: SearchResult[],
  ): SearchResult[] {
    const scoreMap = new Map<string, SearchResult>();

    // 归一化向量分数
    const maxVectorScore = vectorResults.length > 0
      ? Math.max(...vectorResults.map((r) => r.score))
      : 1;

    for (const result of vectorResults) {
      const normalizedScore = (result.score / maxVectorScore) * this.vectorWeight;
      scoreMap.set(result.chunk.id, { ...result, score: normalizedScore });
    }

    // 归一化图分数
    const maxGraphScore = graphResults.length > 0
      ? Math.max(...graphResults.map((r) => r.score))
      : 1;

    for (const result of graphResults) {
      const normalizedScore = (result.score / maxGraphScore) * this.graphWeight;

      const existing = scoreMap.get(result.chunk.id);
      if (existing) {
        // 同一结果在两处都出现，分数相加
        existing.score += normalizedScore;
      } else {
        scoreMap.set(result.chunk.id, { ...result, score: normalizedScore });
      }
    }

    const merged = Array.from(scoreMap.values());
    merged.sort((a, b) => b.score - a.score);
    return merged;
  }
}
