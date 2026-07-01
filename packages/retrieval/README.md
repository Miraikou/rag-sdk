# @ragsdk/retrieval

检索策略包，提供多种检索算法和扩展点。

## 内置检索器

### VectorSearch - 向量语义搜索

```typescript
import { VectorSearch } from '@ragsdk/retrieval';

const vectorSearch = new VectorSearch(embedding, store);
const results = await vectorSearch.retrieve('查询文本', { topK: 5, threshold: 0.7 });
```

### KeywordSearch - BM25 关键词搜索

```typescript
import { KeywordSearch } from '@ragsdk/retrieval';

const keywordSearch = new KeywordSearch(chunks);
const results = await keywordSearch.retrieve('TypeScript 编程', { topK: 5 });
```

内置使用 `Intl.Segmenter` 分词，支持中英文混合。

### FusionSearch - 加权融合搜索

```typescript
import { FusionSearch } from '@ragsdk/retrieval';

const fusion = new FusionSearch(vectorSearch, keywordSearch, 0.6, 0.4);
const results = await fusion.retrieve('查询文本', { topK: 5 });
```

使用 Min-Max 归一化后加权融合。

### RRFSearch - 排名融合

```typescript
import { RRFSearch } from '@ragsdk/retrieval';

const rrf = new RRFSearch(60); // k=60
const results = rrf.fuse([vectorResults, keywordResults], 5, 0.01);
```

业界标准方案，只看排名不看分数。

### SmallToBigSearch - 小块检索大块回溯

```typescript
import { SmallToBigSearch } from '@ragsdk/retrieval';

const smallToBig = new SmallToBigSearch(innerRetriever, store, allChunks);
const results = await smallToBig.retrieve('查询文本', { topK: 5 });
```

### HierarchicalSearch - 分层检索

```typescript
import { HierarchicalSearch } from '@ragsdk/retrieval';

const hierarchical = new HierarchicalSearch(embedding, summaryStore, contentStore);
const results = await hierarchical.retrieve('查询文本', { topK: 5 });
```

---

## 自定义检索器

实现 `Retriever` 接口即可：

```typescript
import type { Retriever, RetrieveOptions, SearchResult } from '@ragsdk/core';

class MyCustomRetriever implements Retriever {
  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    // 你的检索逻辑
    return [
      {
        chunk: { id: '1', documentId: 'doc1', content: '内容', metadata: {} },
        score: 0.95,
        source: 'custom', // 或 'vector' | 'keyword' | 'graph' | 'fusion'
      },
    ];
  }
}
```

### 示例：集成第三方分词库

```typescript
import MiniSearch from 'minisearch';
import type { Retriever, RetrieveOptions, SearchResult, Chunk } from '@ragsdk/core';

export class MiniSearchRetriever implements Retriever {
  private miniSearch: MiniSearch;
  private chunks: Map<string, Chunk>;

  constructor(chunks: Chunk[]) {
    this.chunks = new Map(chunks.map(c => [c.id, c]));
    this.miniSearch = new MiniSearch({
      fields: ['content'],
      searchOptions: { boost: { title: 2 } },
    });
    this.miniSearch.addAll(chunks);
  }

  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    const results = this.miniSearch.search(query, {
      prefix: true,
      fuzzy: 0.2,
    });

    return results
      .slice(0, options?.topK ?? 5)
      .filter(r => !options?.threshold || r.score >= options.threshold)
      .map(r => ({
        chunk: this.chunks.get(r.id)!,
        score: r.score,
        source: 'keyword' as const,
      }));
  }
}
```

### 示例：集成 Elasticsearch

```typescript
import { Client } from '@elastic/elasticsearch';
import type { Retriever, RetrieveOptions, SearchResult } from '@ragsdk/core';

export class ElasticsearchRetriever implements Retriever {
  constructor(private client: Client, private index: string) {}

  async retrieve(query: string, options?: RetrieveOptions): Promise<SearchResult[]> {
    const response = await this.client.search({
      index: this.index,
      query: { match: { content: query } },
      size: options?.topK ?? 5,
      min_score: options?.threshold,
    });

    return response.hits.hits.map(hit => ({
      chunk: {
        id: hit._id,
        documentId: hit._source.documentId,
        content: hit._source.content,
        metadata: hit._source.metadata ?? {},
      },
      score: hit._score ?? 0,
      source: 'keyword' as const,
    }));
  }
}
```

---

## 检索选项

所有检索器都支持：

```typescript
interface RetrieveOptions {
  topK?: number;      // 返回结果数量，默认 5
  threshold?: number; // 最低分数阈值
  filter?: Record<string, unknown>; // 元数据过滤
}
```

---

## 查询变换器

### QueryRewriter - 查询改写

```typescript
import { QueryRewriter } from '@ragsdk/retrieval';

const rewriter = new QueryRewriter(llm);
const rewritten = await rewriter.transform('模糊查询');
// → "精确的检索查询"
```

### MultiQueryExpander - 多查询扩展

```typescript
import { MultiQueryExpander } from '@ragsdk/retrieval';

const expander = new MultiQueryExpander(llm, { numQueries: 3 });
const queries = await expander.transform('原始查询');
// → ["变体1", "变体2", "变体3"]
```

### QueryDecomposer - 查询分解

```typescript
import { QueryDecomposer } from '@ragsdk/retrieval';

const decomposer = new QueryDecomposer(llm);
const subQueries = await decomposer.transform('复杂问题');
// → ["子问题1", "子问题2"]
```

### HyDETransformer - 假设文档嵌入

```typescript
import { HyDETransformer } from '@ragsdk/retrieval';

const hyde = new HyDETransformer(llm);
const hypothetical = await hyde.transform('问题');
// → "假设性的回答文档，用于向量检索"
```

---

## 后处理器

### ThresholdPostProcessor - 阈值过滤

```typescript
import { ThresholdPostProcessor } from '@ragsdk/retrieval';

const threshold = new ThresholdPostProcessor({ threshold: 0.7, maxResults: 10 });
const filtered = await threshold.process(results, query);
```

### ContextEnrichPostProcessor - 上下文丰富

```typescript
import { ContextEnrichPostProcessor } from '@ragsdk/retrieval';

const enricher = new ContextEnrichPostProcessor(store, { windowSize: 2 });
const enriched = await enricher.process(results, query);
```

### SelectiveContextPostProcessor - 选择性上下文

```typescript
import { SelectiveContextPostProcessor } from '@ragsdk/retrieval';

const selector = new SelectiveContextPostProcessor(llm);
const selected = await selector.process(results, query);
```

### CompressionPostProcessor - 内容压缩

```typescript
import { CompressionPostProcessor } from '@ragsdk/retrieval';

const compressor = new CompressionPostProcessor(llm, { maxTokens: 200 });
const compressed = await compressor.process(results, query);
```

### RerankerPostProcessor - 重排序

```typescript
import { RerankerPostProcessor } from '@ragsdk/retrieval';

const reranker = new RerankerPostProcessor(scorer, { topK: 5 });
const reranked = await reranker.process(results, query);
```

---

## 组合使用

```typescript
import { VectorSearch, QueryRewriter, ThresholdPostProcessor } from '@ragsdk/retrieval';

// 1. 查询改写
const rewriter = new QueryRewriter(llm);
const rewrittenQuery = await rewriter.transform(userQuery);

// 2. 向量检索
const retriever = new VectorSearch(embedding, store);
const results = await retriever.retrieve(rewrittenQuery, { topK: 10, threshold: 0.5 });

// 3. 后处理
const threshold = new ThresholdPostProcessor({ threshold: 0.7 });
const filtered = await threshold.process(results, rewrittenQuery);

// 4. 生成
const answer = await generator.generate(rewrittenQuery, filtered.map(r => r.chunk));
```
