# @ragsdk/storage-weaviate

Weaviate 向量数据库适配器，使用原生 fetch，无需安装额外 SDK。

## 安装

```bash
pnpm add @ragsdk/storage-weaviate
```

## 快速开始

```ts
import { WeaviateStore } from '@ragsdk/storage-weaviate';

const store = new WeaviateStore({
  url: process.env.WEAVIATE_URL,
  apiKey: process.env.WEAVIATE_API_KEY,
  className: 'Documents',
  dimension: 1536,
});

await store.upsert([{ id: 'doc-1', vector: [0.1, 0.2, ...], metadata: {} }]);
const results = await store.search([0.1, 0.2, ...], { topK: 5 });
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
