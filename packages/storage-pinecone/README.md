# @ragsdk/storage-pinecone

Pinecone 向量数据库适配器，使用原生 fetch，无需安装额外 SDK。

## 安装

```bash
pnpm add @ragsdk/storage-pinecone
```

## 快速开始

```ts
import { PineconeStore } from '@ragsdk/storage-pinecone';

const store = new PineconeStore({
  apiKey: process.env.PINECONE_API_KEY,
  index: 'your-index-name',
  dimension: 1536,
});

await store.upsert([{ id: 'doc-1', vector: [0.1, 0.2, ...], metadata: {} }]);
const results = await store.search([0.1, 0.2, ...], { topK: 5 });
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
