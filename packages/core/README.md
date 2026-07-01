# @ragsdk/core

RAG SDK 核心模块，提供全局类型定义、Pipeline 编排器与路由。

## 安装

```bash
pnpm add @ragsdk/core
```

## 主要功能

- **RAGPipeline** — 编排 ingest（切块→嵌入→存储）和 query（检索→后处理→生成）流程
- **Router** — 检索路由，支持多 Store 分发
- **全局类型定义** — `LLMProvider`、`EmbeddingProvider`、`VectorStore`、`Chunker`、`Retriever` 等抽象接口
- **Logger** — 内置日志系统

## 快速开始

```ts
import { RAGPipeline } from '@ragsdk/core';
import type { LLMProvider, EmbeddingProvider, VectorStore } from '@ragsdk/core';

const pipeline = new RAGPipeline({
  llm: yourLLMProvider,
  embedding: yourEmbeddingProvider,
  store: yourVectorStore,
  chunker: yourChunker,
  retriever: yourRetriever,
  generator: yourGenerator,
});

// 导入文档
await pipeline.ingest([
  { content: '文档内容', metadata: { source: '文件名' } },
]);

// 查询
const { answer, sources } = await pipeline.query('你的问题');
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
