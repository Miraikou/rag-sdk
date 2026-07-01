# @ragsdk/storage

向量存储抽象接口，内置 MemoryStore 内存实现。

## 安装

```bash
pnpm add @ragsdk/storage
```

## 主要功能

- **VectorStore** — 向量存储抽象接口，定义 `upsert`、`search`、`delete` 方法
- **MemoryStore** — 内置内存向量存储，适合开发和测试使用

## 快速开始

```ts
import { MemoryStore } from '@ragsdk/storage';

const store = new MemoryStore({ dimension: 1536 });

// 插入向量
await store.upsert([
  { id: 'doc-1', vector: [0.1, 0.2, ...], metadata: { source: 'test' } },
]);

// 相似搜索
const results = await store.search([0.1, 0.2, ...], { topK: 5 });

// 删除
await store.delete(['doc-1']);
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
