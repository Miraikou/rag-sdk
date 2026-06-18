# RAG SDK

通用、模块化、可扩展的 TypeScript RAG（检索增强生成）SDK。

提供完整的 RAG pipeline 和多种优化策略，支持自定义 LLM 提供商、向量数据库和检索策略。

## 特性

- 🔌 **接口驱动** — 每个模块定义抽象接口，可自由替换实现
- 🧩 **模块化 Monorepo** — 20 个子包（11 个核心包 + 9 个适配器包），按需引入
- 🔄 **Pipeline 模式** — 一行代码串联文档处理→检索→生成
- 📊 **内置评测** — 检索指标（NDCG/MRR）+ 生成指标（BLEU/ROUGE）+ 端到端评测
- 🕸️ **知识图谱** — 实体抽取 + 图检索，支持多跳推理
- 📝 **TypeScript 严格模式** — 完整类型定义，零 `any`

## 安装

```bash
# 安装主包（包含所有子包）
pnpm add rag-sdk

# 或按需安装子包
pnpm add @rag-sdk/core @rag-sdk/llm @rag-sdk/storage

# 按需安装适配器（需同时安装对应的外部 SDK）
pnpm add @rag-sdk/llm-anthropic @anthropic-ai/sdk
pnpm add @rag-sdk/storage-pinecone @pinecone-database/pinecone
```

## 快速开始

```ts
import { RAGPipeline } from '@rag-sdk/core';
import { OpenAI } from '@rag-sdk/llm';
import { OpenAIEmbedding } from '@rag-sdk/embedding';
import { MemoryStore } from '@rag-sdk/storage';
import { SemanticChunker } from '@rag-sdk/document';
import { FusionRetriever, Reranker } from '@rag-sdk/retrieval';
import { CitationGenerator } from '@rag-sdk/generation';

// 创建 Pipeline
const rag = new RAGPipeline({
  llm: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  embedding: new OpenAIEmbedding({ apiKey: process.env.OPENAI_API_KEY }),
  store: new MemoryStore(),
  chunker: new SemanticChunker(),
  retriever: new FusionRetriever(),
  postProcessors: [new Reranker()],
  generator: new CitationGenerator(),
});

// 导入文档
await rag.ingest([
  { content: '公司年假为15天，入职满一年后开始计算。', metadata: { source: '员工手册' } },
]);

// 查询
const { answer, sources } = await rag.query('年假有几天？');
```

## 模块一览

| 包名 | 说明 |
|------|------|
| [@rag-sdk/core](./packages/core) | 核心类型、Pipeline 编排器、检索路由 |
| [@rag-sdk/llm](./packages/llm) | LLM 抽象接口 + 内置 OpenAI 适配器（零外部依赖） |
| [@rag-sdk/embedding](./packages/embedding) | 向量嵌入抽象接口 + 内置 OpenAI 适配器 |
| [@rag-sdk/storage](./packages/storage) | 向量存储抽象接口 + 内置内存存储和 pgvector |
| [@rag-sdk/document](./packages/document) | 文档加载、切块（4种策略）、清洗、增强、元数据抽取 |
| [@rag-sdk/retrieval](./packages/retrieval) | 查询变换、搜索策略（向量/关键词/融合）、后处理（Re-rank等） |
| [@rag-sdk/generation](./packages/generation) | Prompt 模板、Grounding、引用回答、Self-RAG |
| [@rag-sdk/evaluation](./packages/evaluation) | 检索评测（NDCG/MRR）+ 生成评测（BLEU/ROUGE/BERTScore）+ 端到端 |
| [@rag-sdk/knowledge-graph](./packages/knowledge-graph) | 实体关系抽取、图存储、图检索 |
| [@rag-sdk/indexing](./packages/indexing) | 文档索引编排（加载→清洗→去重→增强→切块→嵌入→存储） |
| [rag-sdk](./packages/rag-sdk) | 主包，re-export 所有子包 + 预设 Pipeline |

### 适配器包

| 适配器包 | 说明 | 外部依赖 |
|---------|------|---------|
| [@rag-sdk/llm-anthropic](./packages/llm-anthropic) | Anthropic Claude LLM | @anthropic-ai/sdk |
| [@rag-sdk/llm-google](./packages/llm-google) | Google Gemini LLM | @google/generative-ai |
| [@rag-sdk/embedding-anthropic](./packages/embedding-anthropic) | Anthropic Embedding | @anthropic-ai/sdk |
| [@rag-sdk/embedding-google](./packages/embedding-google) | Google Embedding | @google/generative-ai |
| [@rag-sdk/embedding-voyage](./packages/embedding-voyage) | Voyage AI Embedding | voyageai |
| [@rag-sdk/storage-pinecone](./packages/storage-pinecone) | Pinecone 向量数据库 | @pinecone-database/pinecone |
| [@rag-sdk/storage-weaviate](./packages/storage-weaviate) | Weaviate 向量数据库 | weaviate-ts-client |
| [@rag-sdk/storage-chroma](./packages/storage-chroma) | Chroma 向量数据库 | chromadb |
| [@rag-sdk/storage-qdrant](./packages/storage-qdrant) | Qdrant 向量数据库 | @qdrant/js-client-rest |

## 目录结构

```
rag-sdk/
├── package.json                  # workspace 根（private）
├── pnpm-workspace.yaml           # pnpm workspace 配置
├── turbo.json                    # Turborepo 任务编排
├── tsconfig.json                 # 共享 TypeScript 基础配置
├── vitest.config.ts              # 测试配置
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
│
├── docs/                         # 需求文档
│   ├── README.md                 # 文档索引
│   ├── 01-项目概述.md
│   ├── 02-架构设计.md
│   ├── 03-核心接口.md
│   ├── 04-文档处理.md
│   ├── 05-检索模块.md
│   ├── 06-生成模块.md
│   ├── 07-评测模块.md
│   └── 08-知识图谱.md
│
├── tests/                        # 跨包集成测试 + 冒烟测试
│   ├── integration/
│   │   └── pipeline.test.ts      # Pipeline 集成测试
│   └── smoke/
│       ├── smoke.test.ts         # 冒烟测试
│       └── type-contract.test.ts # 类型契约验证
│
└── packages/
    ├── core/                     # @rag-sdk/core — 核心类型 + Pipeline + Router
    │   ├── src/
    │   │   ├── index.ts
    │   │   ├── types.ts          # 全局类型定义
    │   │   ├── pipeline.ts       # Pipeline 编排器
    │   │   ├── router.ts         # 检索路由
    │   │   └── logger.ts         # 日志
    │   ├── __tests__/            # 单元测试
    │   │   ├── pipeline.test.ts
    │   │   ├── router.test.ts
    │   │   └── logger.test.ts
    │   ├── demo/                 # 可运行示例
    │   │   └── basic.ts
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── tsup.config.ts
    │
    ├── llm/                      # @rag-sdk/llm — LLM 提供商
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── embedding/                # @rag-sdk/embedding — 向量嵌入
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── storage/                  # @rag-sdk/storage — 向量存储
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── document/                 # @rag-sdk/document — 文档处理
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── retrieval/                # @rag-sdk/retrieval — 检索
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── generation/               # @rag-sdk/generation — 答案生成
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── evaluation/               # @rag-sdk/evaluation — 评测
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── knowledge-graph/          # @rag-sdk/knowledge-graph — 知识图谱
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── indexing/                 # @rag-sdk/indexing — 文档索引编排
    │   ├── src/
    │   │   ├── types.ts
    │   │   ├── indexing-pipeline.ts
    │   │   └── index.ts
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── llm-anthropic/            # @rag-sdk/llm-anthropic — Anthropic Claude 适配器
    ├── llm-google/               # @rag-sdk/llm-google — Google Gemini 适配器
    ├── embedding-anthropic/      # @rag-sdk/embedding-anthropic
    ├── embedding-google/         # @rag-sdk/embedding-google
    ├── embedding-voyage/         # @rag-sdk/embedding-voyage
    ├── storage-pinecone/         # @rag-sdk/storage-pinecone
    ├── storage-weaviate/         # @rag-sdk/storage-weaviate
    ├── storage-chroma/           # @rag-sdk/storage-chroma
    ├── storage-qdrant/           # @rag-sdk/storage-qdrant
    │
    └── rag-sdk/                  # rag-sdk — 主包（re-export + 预设 Pipeline）
        ├── src/
        │   ├── index.ts          # re-export 所有子包
        │   └── pipeline/         # 预设 Pipeline
        │       ├── simple-rag.ts
        │       ├── advanced-rag.ts
        │       └── custom.ts
        ├── __tests__/
        ├── demo/
        └── ...
```

## 支持的 RAG 策略

**文档处理**：语义切块 · 递归切块 · Contextual Chunk Header · 元数据抽取 · 去重清洗 · 文档增强 · 增量更新

**检索优化**：Query Rewrite · Multi-query · HyDE · Query Decomposition · 向量检索 · 关键词检索(BM25) · Fusion · RRF · Small-to-Big · 分层索引 · Re-rank · Context Enriched · RSC · Context Compression · 阈值过滤

**生成增强**：Prompt Template · Grounding · Citation · Self-RAG · 多答案一致性 · LLM-as-Judge

**知识图谱**：实体关系抽取 · 图存储 · 图检索 · 向量+图混合检索

**评测体系**：Recall@K · Precision@K · MRR · NDCG · BLEU · ROUGE · BERTScore · Faithfulness · Answer Relevance · A/B Test

## 文档

详细需求文档在 [docs/](./docs/) 目录：

| 文档 | 内容 |
|------|------|
| [01-项目概述](./docs/01-项目概述.md) | 项目目标、设计理念、功能清单 |
| [02-架构设计](./docs/02-架构设计.md) | Monorepo 结构、模块依赖、实施阶段 |
| [03-核心接口](./docs/03-核心接口.md) | 所有抽象接口定义（TypeScript） |
| [04-文档处理](./docs/04-文档处理.md) | 加载、切块、清洗、增强 |
| [05-检索模块](./docs/05-检索模块.md) | 查询变换、搜索策略、后处理 |
| [06-生成模块](./docs/06-生成模块.md) | Prompt、Grounding、Citation、Self-RAG |
| [07-评测模块](./docs/07-评测模块.md) | 检索/生成/端到端评测 |
| [08-知识图谱](./docs/08-知识图谱.md) | 实体抽取、图存储、图检索 |
| [09-验收标准](./docs/09-验收标准.md) | 阶段验收清单、模块验收标准、接口契约验证 |

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有子包
pnpm run build

# 开发模式（监听变更）
pnpm run dev

# 运行所有测试（单元 + 集成 + 冒烟）
pnpm run test

# 只运行单元测试
pnpm run test:unit

# 只运行集成测试 + 冒烟测试
pnpm run test:e2e

# 类型检查
pnpm run typecheck

# Lint
pnpm run lint

# 运行 demo
npx tsx packages/core/demo/basic.ts
```

## License

MIT
