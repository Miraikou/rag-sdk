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
pnpm add @ragsdk/core @ragsdk/llm @ragsdk/storage

# 按需安装适配器（所有适配器均使用原生 fetch，无需安装额外 SDK）
pnpm add @ragsdk/llm-anthropic
pnpm add @ragsdk/storage-pinecone
```

## 快速开始

```ts
import { RAGPipeline } from '@ragsdk/core';
import { OpenAI } from '@ragsdk/llm';
import { OpenAIEmbedding } from '@ragsdk/embedding';
import { MemoryStore } from '@ragsdk/storage';
import { SemanticChunker } from '@ragsdk/document';
import { FusionRetriever, Reranker } from '@ragsdk/retrieval';
import { CitationGenerator } from '@ragsdk/generation';

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
| [@ragsdk/core](./packages/core) | 核心类型、Pipeline 编排器、检索路由 |
| [@ragsdk/llm](./packages/llm) | LLM 抽象接口 + 内置 OpenAI 适配器（零外部依赖） |
| [@ragsdk/embedding](./packages/embedding) | 向量嵌入抽象接口 + 内置 OpenAI 适配器 |
| [@ragsdk/storage](./packages/storage) | 向量存储抽象接口 + 内置内存存储和 pgvector |
| [@ragsdk/document](./packages/document) | 文档加载、切块（4种策略）、清洗、增强、元数据抽取 |
| [@ragsdk/retrieval](./packages/retrieval) | 查询变换、搜索策略（向量/关键词/融合）、后处理（Re-rank等） |
| [@ragsdk/generation](./packages/generation) | Prompt 模板、Grounding、引用回答、Self-RAG |
| [@ragsdk/evaluation](./packages/evaluation) | 检索评测（NDCG/MRR）+ 生成评测（BLEU/ROUGE/BERTScore）+ 端到端 |
| [@ragsdk/knowledge-graph](./packages/knowledge-graph) | 实体关系抽取、图存储、图检索 |
| [@ragsdk/indexing](./packages/indexing) | 文档索引编排（加载→清洗→去重→增强→切块→嵌入→存储） |
| [rag-sdk](./packages/rag-sdk) | 主包，re-export 所有子包 + 预设 Pipeline |

### 适配器包

| 适配器包 | 说明 | 外部依赖 |
|---------|------|---------|
| [@ragsdk/llm-anthropic](./packages/llm-anthropic) | Anthropic Claude LLM | 无（原生 fetch） |
| [@ragsdk/llm-google](./packages/llm-google) | Google Gemini LLM | 无（原生 fetch） |
| [@ragsdk/embedding-anthropic](./packages/embedding-anthropic) | Anthropic Embedding | 无（原生 fetch） |
| [@ragsdk/embedding-google](./packages/embedding-google) | Google Embedding | 无（原生 fetch） |
| [@ragsdk/embedding-voyage](./packages/embedding-voyage) | Voyage AI Embedding | 无（原生 fetch） |
| [@ragsdk/storage-pinecone](./packages/storage-pinecone) | Pinecone 向量数据库 | 无（原生 fetch） |
| [@ragsdk/storage-weaviate](./packages/storage-weaviate) | Weaviate 向量数据库 | 无（原生 fetch） |
| [@ragsdk/storage-chroma](./packages/storage-chroma) | Chroma 向量数据库 | 无（原生 fetch） |
| [@ragsdk/storage-qdrant](./packages/storage-qdrant) | Qdrant 向量数据库 | 无（原生 fetch） |

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
    ├── core/                     # @ragsdk/core — 核心类型 + Pipeline + Router
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
    ├── llm/                      # @ragsdk/llm — LLM 提供商
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── embedding/                # @ragsdk/embedding — 向量嵌入
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── storage/                  # @ragsdk/storage — 向量存储
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── document/                 # @ragsdk/document — 文档处理
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── retrieval/                # @ragsdk/retrieval — 检索
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── generation/               # @ragsdk/generation — 答案生成
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── evaluation/               # @ragsdk/evaluation — 评测
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── knowledge-graph/          # @ragsdk/knowledge-graph — 知识图谱
    │   ├── src/ ...
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── indexing/                 # @ragsdk/indexing — 文档索引编排
    │   ├── src/
    │   │   ├── types.ts
    │   │   ├── indexing-pipeline.ts
    │   │   └── index.ts
    │   ├── __tests__/
    │   ├── demo/
    │   └── ...
    │
    ├── llm-anthropic/            # @ragsdk/llm-anthropic — Anthropic Claude 适配器
    ├── llm-google/               # @ragsdk/llm-google — Google Gemini 适配器
    ├── embedding-anthropic/      # @ragsdk/embedding-anthropic
    ├── embedding-google/         # @ragsdk/embedding-google
    ├── embedding-voyage/         # @ragsdk/embedding-voyage
    ├── storage-pinecone/         # @ragsdk/storage-pinecone
    ├── storage-weaviate/         # @ragsdk/storage-weaviate
    ├── storage-chroma/           # @ragsdk/storage-chroma
    ├── storage-qdrant/           # @ragsdk/storage-qdrant
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
