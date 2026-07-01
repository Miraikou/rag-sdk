# @ragsdk/embedding-anthropic

Anthropic 嵌入模型适配器，使用原生 fetch，无需安装额外 SDK。

## 安装

```bash
pnpm add @ragsdk/embedding-anthropic
```

## 快速开始

```ts
import { AnthropicEmbeddingProvider } from '@ragsdk/embedding-anthropic';

const embedding = new AnthropicEmbeddingProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const vector = await embedding.embed('你好世界');
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
