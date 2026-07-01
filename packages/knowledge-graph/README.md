# @ragsdk/knowledge-graph

知识图谱模块，提供实体抽取、图谱构建与图谱增强检索。

## 安装

```bash
pnpm add @ragsdk/knowledge-graph
```

## 主要功能

- **EntityExtractor** — 实体关系抽取
- **GraphStore** — 图存储
- **GraphRetriever** — 图检索，支持多跳推理
- **GraphEnhancedRetriever** — 向量 + 图混合检索

## 快速开始

```ts
import { EntityExtractor, GraphBuilder, GraphRetriever } from '@ragsdk/knowledge-graph';

// 抽取实体
const extractor = new EntityExtractor({ llm });
const entities = await extractor.extract('文本内容');

// 构建图谱
const builder = new GraphBuilder({ store });
await builder.build(entities);

// 图检索
const retriever = new GraphRetriever({ store });
const results = await retriever.retrieve('查询', { hops: 2 });
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
