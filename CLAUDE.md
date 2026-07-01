# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

通用、模块化、可扩展的 TypeScript RAG（检索增强生成）SDK。

- **包管理**: pnpm@10.17.0 workspace
- **构建**: tsup（ESM + CJS 双格式 + .d.ts）+ Turborepo 编排
- **测试**: Vitest + v8 覆盖率
- **TypeScript**: strict 模式，零 `any` 策略
- **运行时**: Node.js >= 18

## 常用命令

```bash
pnpm install                        # 安装依赖
pnpm run build                      # 构建所有包（turbo 按依赖顺序）
pnpm run dev                        # 监听模式
pnpm run test                       # 运行所有测试（watch 模式）
pnpm run test:run                   # 运行所有测试（单次）
pnpm run test:unit                  # 仅单元测试
pnpm run test:e2e                   # 仅集成 + 冒烟测试
pnpm run typecheck                  # 类型检查所有包
pnpm run lint                       # ESLint
pnpm run lint:fix                   # ESLint 修复
pnpm run format                     # Prettier 格式化
pnpm run clean                      # 清理 dist/

# 运行单个包的测试
npx vitest run packages/retrieval/__tests__

# 运行单个测试文件
npx vitest run packages/core/__tests__/pipeline.test.ts

# 运行 demo
npx tsx packages/core/demo/basic.ts
```

## 架构

### Monorepo 结构

20 个子包（11 核心 + 9 适配器），使用 `workspace:*` 协议互相依赖。

**核心包**（已实现）：

| 包 | 职责 |
|---|------|
| `@ragsdk/core` | 全局类型定义、`RAGPipeline` 编排器、`Router` 路由、`Logger` |
| `@ragsdk/llm` | `LLMProvider` 抽象 + 内置 OpenAI 适配器 |
| `@ragsdk/embedding` | `EmbeddingProvider` 抽象 + 内置 OpenAI 适配器 |
| `@ragsdk/storage` | `VectorStore` 抽象 + `MemoryStore` 内存实现 |
| `@ragsdk/document` | `Chunker` 切块（4 种策略）、文档加载、清洗、增强 |
| `@ragsdk/retrieval` | 查询变换（Rewrite/HyDE/MultiQuery/Decomposition）、搜索策略（Vector/Keyword/Fusion/RRF/SmallToBig/Hierarchical）、后处理（Reranker/Threshold/ContextEnrich/Compression/SelectiveContext） |
| `@ragsdk/generation` | `Generator` 抽象、PromptTemplate、CitationGenerator、GroundingGenerator、SelfRAGGenerator、ConsistencyGenerator |
| `@ragsdk/indexing` | `IndexingPipeline`：加载 → 清洗 → 去重 → 元数据抽取 → 增强 → 切块 → 嵌入 → 存储 |
| `rag-sdk` | 伞包，re-export 所有子包 + 预设 Pipeline（Simple/Advanced/Custom） |

**Stub 包**（空实现，待开发）：

| 包 | 状态 |
|---|------|
| `@ragsdk/evaluation` | Benchmark、Report、检索/生成/端到端评测，已完整实现 |
| `@ragsdk/knowledge-graph` | 实体抽取、图谱构建、图谱检索、图谱增强检索，已完整实现 |
| 9 个适配器包（llm-anthropic/google、embedding-anthropic/google/voyage、storage-pinecone/weaviate/chroma/qdrant） | 使用原生 fetch 实现，无需安装第三方 SDK |

### 依赖图

```
core（无依赖）
├── llm, embedding, storage（依赖 core）
├── document（依赖 core, embedding）
├── retrieval（依赖 core, embedding, storage）
├── generation（依赖 core, llm）
├── indexing（依赖 core, document, embedding, storage）
├── knowledge-graph（依赖 core, llm, storage）
├── evaluation（依赖 core, llm）
└── rag-sdk（依赖所有核心包）
```

适配器包依赖对应的基包（如 `llm-anthropic` 依赖 `core` + `llm`）。

### 核心设计模式

**接口驱动**：所有模块在 `@ragsdk/core` 的 `types.ts` 中定义抽象接口，具体实现在各自包中。关键接口：`LLMProvider`、`EmbeddingProvider`、`VectorStore`、`Chunker`、`Retriever`、`PostProcessor`、`Generator`、`Pipeline`。

**Pipeline 编排**：
- `RAGPipeline`：ingest（chunk → embed → store）和 query（transform → retrieve → post-process → generate）
- `IndexingPipeline`：load → clean → deduplicate → extract metadata → augment → chunk → embed → store

**适配器外部依赖**：第三方 SDK（如 `@anthropic-ai/sdk`、`@pinecone-database/pinecone`）作为 **peer dependencies**，不打包进 SDK。

## 代码风格

- **ESLint**: `@typescript-eslint/recommended`，`no-explicit-any: error`，`no-unused-vars: [error, { argsIgnorePattern: ^_ }]`，`no-non-null-assertion: warn`
- **Prettier**: `semi: true`，`singleQuote: true`，`trailingComma: "all"`，`printWidth: 100`，`tabWidth: 2`
- **注释语言**: JSDoc 和代码注释使用中文
- **测试描述**: 使用中文

## 构建细节

每个包使用相同的 tsup 配置：`entry: [src/index.ts]`，`format: [esm, cjs]`，`dts: true`，`splitting: false`，`sourcemap: true`，`clean: true`。

输出：`dist/index.js`（ESM）、`dist/index.cjs`（CJS）、`dist/index.d.ts` / `dist/index.d.cts`（类型声明）。

Turborepo 任务：`build` 依赖 `^build`（先构建依赖包）；`typecheck` 同样依赖 `^build`。

## TypeScript 配置

根目录 `tsconfig.json` 是共享基础配置，各包通过 `"extends": "../../tsconfig.json"` 继承。

关键选项：`target: ES2022`、`module: ESNext`、`moduleResolution: bundler`、`strict: true`、`noUncheckedIndexedAccess: true`、`noImplicitOverride: true`、`isolatedModules: true`。

测试文件（`**/*.test.ts`、`**/*.spec.ts`）不参与编译。

## 测试约定

- 单元测试：`packages/*/__tests__/**/*.test.ts`
- 集成测试：`tests/integration/*.test.ts`
- 冒烟测试：`tests/smoke/*.test.ts`
- 覆盖率：v8 provider，覆盖 `packages/*/src/**/*.ts`，排除 types.ts、demo、测试文件
- Mock：使用 `vi.fn()` 创建核心接口的 mock 实现

## 需求文档

详细设计文档在 `docs/` 目录（中文）：

| 文档 | 内容 |
|------|------|
| [01-项目概述](./docs/01-项目概述.md) | 项目目标、设计理念 |
| [02-架构设计](./docs/02-架构设计.md) | Monorepo 结构、模块依赖、实施阶段 |
| [03-核心接口](./docs/03-核心接口.md) | 所有抽象接口定义 |
| [04-文档处理](./docs/04-文档处理.md) | 加载、切块、清洗、增强 |
| [05-检索模块](./docs/05-检索模块.md) | 查询变换、搜索策略、后处理 |
| [06-生成模块](./docs/06-生成模块.md) | Prompt、Grounding、Citation、Self-RAG |
| [07-评测模块](./docs/07-评测模块.md) | 检索/生成/端到端评测 |
| [08-知识图谱](./docs/08-知识图谱.md) | 实体抽取、图存储、图检索 |
| [09-验收标准](./docs/09-验收标准.md) | 阶段验收、模块验收、接口契约验证 |
