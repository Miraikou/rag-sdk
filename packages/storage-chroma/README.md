# @ragsdk/storage-chroma

Chroma 向量数据库适配器，使用原生 fetch，无需安装额外 SDK。

## 安装

```bash
pnpm add @ragsdk/storage-chroma
```

## 快速开始

```ts
import { ChromaStore } from '@ragsdk/storage-chroma';

const store = new ChromaStore({
  url: process.env.CHROMA_URL || 'http://localhost:8000',
  collection: 'documents',
  dimension: 1536,
});

await store.upsert([{ id: 'doc-1', vector: [0.1, 0.2, ...], metadata: {} }]);
const results = await store.search([0.1, 0.2, ...], { topK: 5 });
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
