import { createHash } from 'crypto';
import type {
  Chunk,
  Chunker,
  Document,
  EmbeddingProvider,
  VectorStore,
} from '@ragsdk/core';

/** 增量同步报告 */
export interface SyncReport {
  /** 新增文档数 */
  added: number;
  /** 更新文档数 */
  updated: number;
  /** 删除文档数 */
  deleted: number;
  /** 未变化文档数 */
  unchanged: number;
}

/** 文档 Hash 记录 */
export interface DocumentHashRecord {
  documentId: string;
  hash: string;
  updatedAt: string;
}

/** IndexManager 配置选项 */
export interface IndexManagerOptions {
  /** Hash 算法，默认 'sha256' */
  hashAlgorithm?: string;
}

/**
 * 增量更新管理器
 *
 * 维护文档内容 Hash 记录，在每次摄入时检测文档变更（新增、修改、删除），
 * 只处理变化的文档。避免全量重建索引的高昂成本。
 *
 * Hash 记录默认存储在内存中，生产环境可通过 `getHashSnapshot()` /
 * `restoreHashRecords()` 方法实现持久化。
 */
export class IndexManager {
  private readonly store: VectorStore;
  private readonly chunker: Chunker;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly hashAlgorithm: string;

  /** 内存中的 Hash 记录 */
  private hashStore: Map<string, DocumentHashRecord>;

  /**
   * @param store - 向量存储
   * @param chunker - 切块策略
   * @param embeddingProvider - 向量嵌入提供商
   * @param options - 配置选项
   */
  constructor(
    store: VectorStore,
    chunker: Chunker,
    embeddingProvider: EmbeddingProvider,
    options?: IndexManagerOptions
  ) {
    this.store = store;
    this.chunker = chunker;
    this.embeddingProvider = embeddingProvider;
    this.hashAlgorithm = options?.hashAlgorithm ?? 'sha256';
    this.hashStore = new Map();
  }

  /**
   * 同步文档列表到向量存储，只处理变化的文档
   *
   * @param documents - 当前最新的完整文档列表
   * @returns 同步报告（新增、更新、删除、未变化的数量）
   */
  async sync(documents: Document[]): Promise<SyncReport> {
    const report: SyncReport = { added: 0, updated: 0, deleted: 0, unchanged: 0 };

    // 1. 计算当前文档的 Hash
    const currentHashes = new Map<string, string>();
    for (const doc of documents) {
      currentHashes.set(doc.id, this.computeHash(doc.content));
    }

    // 2. 检测新增和修改
    const docsToProcess: Document[] = [];
    for (const doc of documents) {
      const existing = this.hashStore.get(doc.id);
      const currentHash = currentHashes.get(doc.id)!;

      if (!existing) {
        report.added++;
        docsToProcess.push(doc);
      } else if (existing.hash !== currentHash) {
        report.updated++;
        docsToProcess.push(doc);
      } else {
        report.unchanged++;
      }
    }

    // 3. 检测删除（在 Hash 记录中但不在当前文档列表中）
    const currentIds = new Set(documents.map((d) => d.id));
    const deletedIds: string[] = [];
    for (const [docId] of this.hashStore) {
      if (!currentIds.has(docId)) {
        deletedIds.push(docId);
        report.deleted++;
      }
    }

    // 4a. 删除已移除的文档
    for (const docId of deletedIds) {
      await this.store.deleteByDocument(docId);
      this.hashStore.delete(docId);
    }

    // 4b. 处理新增和修改的文档
    for (const doc of docsToProcess) {
      // 如果是更新，先删除旧数据
      if (this.hashStore.has(doc.id)) {
        await this.store.deleteByDocument(doc.id);
      }

      // 切块
      const chunks = this.chunker.chunk(doc);

      // 嵌入
      const texts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingProvider.embedBatch(texts);
      const embeddedChunks: Chunk[] = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));

      // 写入存储
      await this.store.upsertByDocument(doc.id, embeddedChunks);

      // 更新 Hash 记录
      this.hashStore.set(doc.id, {
        documentId: doc.id,
        hash: currentHashes.get(doc.id)!,
        updatedAt: new Date().toISOString(),
      });
    }

    return report;
  }

  /**
   * 获取当前 Hash 记录的快照（用于持久化或调试）
   *
   * @returns 所有 Hash 记录的数组
   */
  getHashSnapshot(): DocumentHashRecord[] {
    return Array.from(this.hashStore.values());
  }

  /**
   * 从外部恢复 Hash 记录（如从数据库加载）
   *
   * @param records - 要恢复的 Hash 记录数组
   */
  restoreHashRecords(records: DocumentHashRecord[]): void {
    this.hashStore.clear();
    for (const record of records) {
      this.hashStore.set(record.documentId, record);
    }
  }

  /**
   * 计算文本内容 Hash
   *
   * 标准化空白后计算 Hash，确保仅空格差异的文档也能被检测到。
   */
  private computeHash(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    return createHash(this.hashAlgorithm).update(normalized).digest('hex');
  }
}
