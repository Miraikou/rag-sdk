# @ragsdk/llm

LLM 提供者抽象接口，内置 OpenAI 适配器。

## 安装

```bash
pnpm add @ragsdk/llm
```

## 主要功能

- **LLMProvider** — LLM 抽象接口，定义 `chat` 和 `chatStream` 方法
- **OpenAI** — 内置 OpenAI 适配器，支持 GPT-4o / GPT-4 / GPT-3.5 等模型

## 快速开始

```ts
import { OpenAI } from '@ragsdk/llm';

const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
});

// 普通对话
const response = await llm.chat([
  { role: 'user', content: '你好' },
]);

// 流式输出
const stream = await llm.chatStream([
  { role: 'user', content: '你好' },
]);
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
