import type { Chunk, Document } from '@rag-sdk/core';
import type { IndexingConfig, IndexingReport } from './types';

/**
 * Indexing Pipeline — 文档索引编排器
 *
 * 串联完整的文档索引流程：
 * 加载 → 清洗 → 去重 → 元数据抽取 → 增强 → 切块 → 嵌入 → 存储
 *
 * 只有 切块/嵌入/存储 是必填步骤，其余步骤按需启用。
 */
export class IndexingPipeline {
  private config: IndexingConfig;

  constructor(config: IndexingConfig) {
    this.config = config;
  }

  /**
   * 从文件路径或 Buffer 加载并索引文档
   */
  async indexFromSource(source: string | Buffer): Promise<IndexingReport> {
    if (!this.config.loader) {
      throw new Error('loader is required for indexFromSource. Pass documents to index() instead.');
    }

    const documents = await this.config.loader.load(source);
    return this.index(documents);
  }

  /**
   * 索引已加载的文档列表
   */
  async index(documents: Document[]): Promise<IndexingReport> {
    const startTime = Date.now();
    const report: IndexingReport = {
      documentsLoaded: documents.length,
      documentsAfterDedup: documents.length,
      chunksCreated: 0,
      chunksEmbedded: 0,
      chunksStored: 0,
      duration: 0,
    };

    let docs = [...documents];

    // 1. 清洗
    if (this.config.cleaner) {
      docs = await this.config.cleaner.clean(docs);
    }

    // 2. 去重
    if (this.config.deduplicator) {
      docs = await this.config.deduplicator.deduplicate(docs);
      report.documentsAfterDedup = docs.length;
    }

    // 3. 元数据抽取
    if (this.config.metadataExtractor) {
      docs = await this.config.metadataExtractor.extract(docs);
    }

    // 4. 文档增强
    if (this.config.augmenter) {
      docs = await this.config.augmenter.augment(docs);
    }

    // 5. 切块
    const allChunks: Chunk[] = [];
    for (const doc of docs) {
      const chunks = this.config.chunker.chunk(doc);
      allChunks.push(...chunks);
    }
    report.chunksCreated = allChunks.length;

    // 6. 嵌入
    const texts = allChunks.map((c) => c.content);
    const embeddings = await this.config.embedding.embedBatch(texts);
    for (let i = 0; i < allChunks.length; i++) {
      allChunks[i]!.embedding = embeddings[i];
    }
    report.chunksEmbedded = allChunks.length;

    // 7. 存储
    await this.config.store.upsert(allChunks);
    report.chunksStored = allChunks.length;

    report.duration = Date.now() - startTime;
    return report;
  }

  /**
   * 增量索引：按文档 ID 更新
   * 先删除旧 chunk，再重新索引
   */
  async reindexDocument(document: Document): Promise<IndexingReport> {
    // 删除旧数据
    await this.config.store.deleteByDocument(document.id);

    // 重新索引
    return this.index([document]);
  }
}
