# @ragsdk/generation

生成模块，提供提示词模板与多种生成策略。

## 安装

```bash
pnpm add @ragsdk/generation
```

## 主要功能

- **Generator** — 生成器抽象接口
- **PromptTemplate** — 提示词模板，支持变量插值
- **CitationGenerator** — 带引用的回答生成
- **GroundingGenerator** — 基于检索结果的接地回答
- **SelfRAGGenerator** — Self-RAG 自反思生成
- **ConsistencyGenerator** — 多答案一致性验证

## 快速开始

```ts
import { CitationGenerator, PromptTemplate } from '@ragsdk/generation';

const generator = new CitationGenerator({ llm });

const { answer, citations } = await generator.generate(
  '用户问题',
  retrievedContexts
);
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
