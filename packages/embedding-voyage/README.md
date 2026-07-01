# @ragsdk/embedding-voyage

Voyage AI 嵌入模型适配器，使用原生 fetch，无需安装额外 SDK。

## 安装

```bash
pnpm add @ragsdk/embedding-voyage
```

## 快速开始

```ts
import { VoyageEmbeddingProvider } from '@ragsdk/embedding-voyage';

const embedding = new VoyageEmbeddingProvider({
  apiKey: process.env.VOYAGE_API_KEY,
});

const vector = await embedding.embed('你好世界');
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
