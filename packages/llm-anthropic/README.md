# @ragsdk/llm-anthropic

Anthropic Claude LLM 适配器，使用原生 fetch，无需安装额外 SDK。

## 安装

```bash
pnpm add @ragsdk/llm-anthropic
```

## 快速开始

```ts
import { AnthropicProvider } from '@ragsdk/llm-anthropic';

const llm = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
});

const response = await llm.chat([
  { role: 'user', content: '你好' },
]);
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
