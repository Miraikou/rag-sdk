# @ragsdk/indexing

索引管道，编排文档加载、清洗、切块、嵌入与存储。

## 安装

```bash
pnpm add @ragsdk/indexing
```

## 主要功能

- **IndexingPipeline** — 完整的文档索引流水线：加载 → 清洗 → 去重 → 元数据抽取 → 增强 → 切块 → 嵌入 → 存储

## 快速开始

```ts
import { IndexingPipeline } from '@ragsdk/indexing';

const pipeline = new IndexingPipeline({
  loader: yourLoader,
  cleaner: yourCleaner,
  chunker: yourChunker,
  embedding: yourEmbedding,
  store: yourStore,
});

// 执行索引
await pipeline.run(['path/to/file1.txt', 'path/to/file2.pdf']);
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
