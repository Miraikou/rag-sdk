# @ragsdk/storage-pgvector

PostgreSQL pgvector 向量存储适配器。

## 安装

```bash
pnpm add @ragsdk/storage-pgvector pg
```

> 需要同时安装 `pg` 包（peer dependency）。

## 快速开始

```ts
import { PgVectorStore } from '@ragsdk/storage-pgvector';

const store = new PgVectorStore({
  connectionString: process.env.DATABASE_URL,
  table: 'embeddings',
  dimension: 1536,
});

await store.upsert([{ id: 'doc-1', vector: [0.1, 0.2, ...], metadata: {} }]);
const results = await store.search([0.1, 0.2, ...], { topK: 5 });
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
