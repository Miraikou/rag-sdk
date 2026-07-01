# @ragsdk/document

文档处理模块，提供切块、加载、清洗与增强功能。

## 安装

```bash
pnpm add @ragsdk/document
```

## 主要功能

- **Chunker** — 4 种切块策略：固定大小、递归、语义、Markdown
- **DocumentLoader** — 支持 Text、PDF、CSV、JSON、Markdown、HTML 格式加载
- **DocumentCleaner** — 文档清洗（去空白、去重行、规范化）
- **DocumentAugmenter** — 文档增强（添加上下文头、元数据）
- **MetadataExtractor** — 自动抽取文档元数据
- **Deduplicator** — 文档去重

## 快速开始

```ts
import { SemanticChunker, TextLoader, DocumentCleaner } from '@ragsdk/document';

// 加载文档
const loader = new TextLoader();
const docs = await loader.load('path/to/file.txt');

// 清洗
const cleaner = new DocumentCleaner();
const cleaned = cleaner.clean(docs);

// 切块
const chunker = new SemanticChunker({ maxChunkSize: 500 });
const chunks = chunker.chunk(cleaned);
```

## 文档

完整文档请参考 [rag-sdk 主仓库](https://github.com/Miraikou/rag-sdk)。

## License

MIT
