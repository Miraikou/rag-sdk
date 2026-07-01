# @ragsdk/embedding

嵌入模型提供者抽象接口，内置 OpenAI 适配器。

## 安装

```bash
pnpm add @ragsdk/embedding
```

## 主要功能

- **EmbeddingProvider** — 嵌入模型抽象接口，定义 `embed` 和 `embedBatch` 方法
- **OpenAIEmbedding** — 内置 OpenAI 嵌入模型适配器

## 快速开始

```ts
import { OpenAIEmbedding } from '@ragsdk/embedding';

const embedding = new OpenAIEmbedding({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
});

// 单条嵌入
const vector = await embedding.embed('你好世界');

// 批量嵌入
const vectors = await embedding.embedBatch(['文本1', '文本2', '文本3']);
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
