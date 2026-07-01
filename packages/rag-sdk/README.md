# rag-sdk

通用、模块化、可扩展的 TypeScript RAG（检索增强生成）SDK 伞包。

一键安装所有子包，提供预设 Pipeline 快速上手。

## 安装

```bash
pnpm add rag-sdk
```

## 预设 Pipeline

### SimpleRAG — 最简单的 RAG

```ts
import { createSimpleRAG } from 'rag-sdk';

const rag = await createSimpleRAG({
  openaiApiKey: process.env.OPENAI_API_KEY,
});

await rag.ingest([{ content: '文档内容', metadata: {} }]);
const { answer } = await rag.query('你的问题');
```

### AdvancedRAG — 带查询变换和后处理

```ts
import { createAdvancedRAG } from 'rag-sdk';

const rag = await createAdvancedRAG({
  openaiApiKey: process.env.OPENAI_API_KEY,
  queryTransform: 'rewrite',
  postProcessors: ['reranker'],
});
```

### PipelineBuilder — 链式构建

```ts
import { PipelineBuilder } from 'rag-sdk';

const rag = new PipelineBuilder()
  .withLLM(yourLLM)
  .withEmbedding(yourEmbedding)
  .withStore(yourStore)
  .withChunker(yourChunker)
  .withRetriever(yourRetriever)
  .withGenerator(yourGenerator)
  .build();
```

## 子包一览

| 包 | 说明 |
|---|------|
| [@ragsdk/core](https://www.npmjs.com/package/@ragsdk/core) | 核心类型、Pipeline 编排器 |
| [@ragsdk/llm](https://www.npmjs.com/package/@ragsdk/llm) | LLM 抽象接口 + OpenAI 适配器 |
| [@ragsdk/embedding](https://www.npmjs.com/package/@ragsdk/embedding) | 嵌入模型抽象 + OpenAI 适配器 |
| [@ragsdk/storage](https://www.npmjs.com/package/@ragsdk/storage) | 向量存储抽象 + MemoryStore |
| [@ragsdk/document](https://www.npmjs.com/package/@ragsdk/document) | 文档加载、切块、清洗 |
| [@ragsdk/retrieval](https://www.npmjs.com/package/@ragsdk/retrieval) | 查询变换、搜索策略、后处理 |
| [@ragsdk/generation](https://www.npmjs.com/package/@ragsdk/generation) | 提示词模板、生成策略 |
| [@ragsdk/indexing](https://www.npmjs.com/package/@ragsdk/indexing) | 索引管道 |
| [@ragsdk/evaluation](https://www.npmjs.com/package/@ragsdk/evaluation) | 评测模块 |
| [@ragsdk/knowledge-graph](https://www.npmjs.com/package/@ragsdk/knowledge-graph) | 知识图谱 |

## 文档

完整文档请参考 [GitHub 仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
