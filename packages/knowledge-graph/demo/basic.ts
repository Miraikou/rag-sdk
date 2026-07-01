/**
 * @ragsdk/knowledge-graph 基础用法示例
 *
 * 运行: npx tsx packages/knowledge-graph/demo/basic.ts
 *
 * 需要设置环境变量 OPENAI_API_KEY 以运行 LLM 相关功能
 */
import 'dotenv/config';
import {
  EntityExtractor,
  MemoryGraphStore,
  GraphBuilder,
  GraphRetriever,
  GraphEnhancedRetriever,
} from '../src/index';
import type { Entity, Relation } from '../src/index';
import type { Retriever } from '@ragsdk/core';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  // ==================== MemoryGraphStore 基本操作 ====================

  console.log('=== MemoryGraphStore 基本操作 ===\n');

  const store = new MemoryGraphStore();

  // 创建实体
  const python: Entity = { id: 'python', name: 'Python', type: '编程语言', metadata: {} };
  const django: Entity = { id: 'django', name: 'Django', type: '框架', metadata: {} };
  const flask: Entity = { id: 'flask', name: 'Flask', type: '框架', metadata: {} };

  // 批量添加实体
  await store.addEntities([python, django, flask]);
  console.log('已添加实体: Python, Django, Flask');

  // 批量添加关系
  const relations: Relation[] = [
    { source: 'django', target: 'python', type: 'BUILT_WITH', metadata: {} },
    { source: 'flask', target: 'python', type: 'BUILT_WITH', metadata: {} },
  ];
  await store.addRelations(relations);
  console.log('已添加关系: Django→Python, Flask→Python\n');

  console.log('微型知识图谱:');
  console.log('  Django ──BUILT_WITH──→ Python');
  console.log('  Flask  ──BUILT_WITH──→ Python\n');

  // 查询邻居
  const neighbors = await store.getNeighbors('python');
  console.log('Python 的邻居实体:');
  neighbors.entities.forEach((e) => {
    console.log(`  - ${e.name} (${e.type})`);
  });
  console.log(`  关系数: ${neighbors.relations.length}\n`);

  // 关键词查询
  const queryResult = await store.query('python');
  console.log(`查询 "python": 找到 ${queryResult.entities.length} 个实体`);
  queryResult.entities.forEach((e) => console.log(`  - ${e.name} (${e.type})`));

  if (!apiKey) {
    console.log('\n⚠️  设置 OPENAI_API_KEY 可运行 LLM 相关功能（实体抽取、图谱构建/检索等）');
    return;
  }

  // ==================== 实体抽取 ====================

  console.log('\n=== 实体抽取 ===\n');

  const { OpenAIProvider } = await import('@ragsdk/llm');
  const llm = new OpenAIProvider({ apiKey, defaultModel: process.env.DEFAULT_MODEL ?? 'gpt-4o-mini', baseUrl: process.env.OPENAI_BASE_URL });

  const extractor = new EntityExtractor({
    llmProvider: llm,
    entityTypes: ['人物', '组织', '地点', '产品'],
  });

  const text = '乔布斯于 1976 年在美国加利福尼亚州创立了苹果公司。苹果公司的总部位于库比蒂诺。';

  const graphData = await extractor.extract({
    id: 'doc-1',
    content: text,
    metadata: {},
  });

  console.log(`输入文本: "${text}"`);
  console.log(`抽取到 ${graphData.entities.length} 个实体, ${graphData.relations.length} 个关系:\n`);
  graphData.entities.forEach((e) => {
    console.log(`  - ${e.name} (类型: ${e.type})`);
  });
  if (graphData.relations.length > 0) {
    console.log('  关系:');
    graphData.relations.forEach((r) => {
      console.log(`    ${r.source} → ${r.target} (${r.type})`);
    });
  }

  // ==================== 图谱构建 ====================

  console.log('\n=== 图谱构建 ===\n');

  const graphStore = new MemoryGraphStore();
  const builder = new GraphBuilder({
    extractor,
    graphStore,
  });

  const documents = [
    {
      id: 'd1',
      content: '苹果公司由史蒂夫·乔布斯创立，是一家美国科技公司。',
      metadata: {},
    },
    {
      id: 'd2',
      content: '蒂姆·库克是苹果公司的现任 CEO，他于 2011 年接替乔布斯。',
      metadata: {},
    },
  ];

  const buildReport = await builder.buildFromDocuments(documents);
  console.log('图谱构建报告:');
  console.log(`  文档数: ${buildReport.documentCount}`);
  console.log(`  实体数: ${buildReport.entityCount}`);
  console.log(`  关系数: ${buildReport.relationCount}`);
  console.log(`  耗时: ${buildReport.durationMs}ms\n`);

  // ==================== 图谱检索 ====================

  console.log('=== 图谱检索 ===\n');

  const graphRetriever = new GraphRetriever({
    graphStore,
    llmProvider: llm,
  });

  const retrievalResults = await graphRetriever.retrieve('苹果公司的创始人是谁？');
  console.log('检索 "苹果公司的创始人是谁？":');
  console.log(`结果数: ${retrievalResults.length}`);
  retrievalResults.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.chunk.id}] score=${r.score.toFixed(2)} "${r.chunk.content.substring(0, 80)}"`);
  });

  // ==================== 图谱增强检索 ====================

  console.log('\n=== 图谱增强检索 ===\n');

  // 需要一个向量检索器用于语义搜索
  const mockVectorRetriever: Retriever = {
    retrieve: async () => retrievalResults,
  };

  const enhancedRetriever = new GraphEnhancedRetriever({
    vectorRetriever: mockVectorRetriever,
    graphRetriever,
    graphStore,
    vectorWeight: 0.6,
    graphWeight: 0.4,
  });

  const enhancedResults = await enhancedRetriever.retrieve('苹果公司的创始人是谁？');
  console.log('增强检索结果:');
  console.log(`结果数: ${enhancedResults.length}`);
  enhancedResults.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.chunk.id}] score=${r.score.toFixed(2)}`);
  });
}

main().catch(console.error);
