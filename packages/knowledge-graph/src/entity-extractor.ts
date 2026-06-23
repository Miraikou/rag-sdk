import { z } from 'zod';
import type { Document, LLMProvider, Message } from '@rag-sdk/core';
import type { Entity, GraphData, Relation, EntityExtractorOptions } from './types';

/** LLM 抽取结果的 Zod schema */
const ExtractionResultSchema = z.object({
  entities: z.array(z.object({
    name: z.string().describe('实体名称（标准化后的名称）'),
    type: z.string().describe('实体类型'),
    metadata: z.record(z.string(), z.unknown()).describe('附加元数据，如原文表述'),
  })).describe('提取到的实体列表'),
  relations: z.array(z.object({
    source: z.string().describe('源实体名称'),
    target: z.string().describe('目标实体名称'),
    type: z.string().describe('关系类型'),
    metadata: z.record(z.string(), z.unknown()).describe('附加元数据，如原文表述'),
  })).describe('提取到的关系列表'),
}).describe('从文档中提取的实体和关系');

/**
 * 实体关系抽取器
 *
 * 使用 LLM 从非结构化文档中自动提取实体和关系，
 * 输出结构化的图数据（GraphData）。
 *
 * 使用 chatJson + Zod schema 确保输出格式可靠。
 */
export class EntityExtractor {
  private readonly llmProvider: LLMProvider;
  private readonly entityTypes: string[];
  private readonly relationTypes: string[];
  private readonly extractPrompt?: string;

  /**
   * @param options - 抽取器配置
   * @param options.llmProvider - LLM 提供商
   * @param options.entityTypes - 需要提取的实体类型列表，默认 7 种通用类型
   * @param options.relationTypes - 需要提取的关系类型列表，默认 7 种通用类型
   * @param options.extractPrompt - 自定义抽取 prompt（覆盖默认）
   */
  constructor(options: EntityExtractorOptions) {
    this.llmProvider = options.llmProvider;
    this.entityTypes = options.entityTypes ?? [
      '人物', '组织', '产品', '地点', '概念', '技术', '事件',
    ];
    this.relationTypes = options.relationTypes ?? [
      '管理', '属于', '依赖', '位于', '创建', '使用', '包含',
    ];
    this.extractPrompt = options.extractPrompt;
  }

  /**
   * 从文档中抽取实体和关系
   *
   * @param document - 输入文档
   * @returns 抽取的图数据
   */
  async extract(document: Document): Promise<GraphData> {
    const entityTypesStr = this.entityTypes.join('、');
    const relationTypesStr = this.relationTypes.join('、');

    const prompt = this.extractPrompt ?? this.buildDefaultPrompt(
      document.content,
      entityTypesStr,
      relationTypesStr,
    );

    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个知识图谱构建专家，精确地从文本中提取实体和关系。',
      },
      { role: 'user', content: prompt },
    ];

    const schema = z.toJSONSchema(ExtractionResultSchema);
    const parsed = await this.llmProvider.chatJson<{
      entities: Array<{ name: string; type: string; metadata: Record<string, unknown> }>;
      relations: Array<{ source: string; target: string; type: string; metadata: Record<string, unknown> }>;
    }>(messages, schema, { temperature: 0 });

    // 为实体生成唯一 ID
    const entityMap = new Map<string, string>();
    const entities: Entity[] = parsed.entities.map((e, index) => {
      const id = this.generateEntityId(e.name);
      entityMap.set(e.name, id);
      return {
        id,
        name: e.name,
        type: e.type,
        metadata: {
          ...e.metadata,
          sourceDocumentId: document.id,
        },
      };
    });

    // 解析关系，使用实体 ID 替代名称
    const relations: Relation[] = parsed.relations
      .filter((r) => entityMap.has(r.source) && entityMap.has(r.target))
      .map((r) => ({
        source: entityMap.get(r.source)!,
        target: entityMap.get(r.target)!,
        type: r.type,
        metadata: {
          ...r.metadata,
          sourceDocumentId: document.id,
        },
      }));

    return { entities, relations };
  }

  /**
   * 构建默认抽取 prompt
   *
   * @param content - 文档内容
   * @param entityTypesStr - 实体类型列表（中文顿号分隔）
   * @param relationTypesStr - 关系类型列表（中文顿号分隔）
   * @returns 完整的抽取提示词
   */
  private buildDefaultPrompt(
    content: string,
    entityTypesStr: string,
    relationTypesStr: string,
  ): string {
    return `请从以下文档中提取实体和关系。

## 文档内容
${content}

## 实体类型
${entityTypesStr}

## 关系类型
${relationTypesStr}

## 要求
1. 提取所有符合上述类型的实体
2. 提取实体之间的关系
3. 实体名称要标准化（如"苹果公司"和"Apple Inc."统一为一个名称）`;
  }

  /**
   * 生成实体唯一 ID
   *
   * 基于实体名称的规范化处理，确保同名实体在不同文档中获得相同 ID。
   *
   * @param name - 实体名称
   * @returns 格式为 `entity_{normalized_name}` 的唯一标识
   */
  private generateEntityId(name: string): string {
    const normalized = name.trim().toLowerCase().replace(/\s+/g, '_');
    return `entity_${normalized}`;
  }
}
