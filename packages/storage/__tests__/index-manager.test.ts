import type {
  Chunk,
  Chunker,
  Document,
  EmbeddingProvider,
  VectorStore,
} from '@rag-sdk/core';
import { IndexManager } from '../src/index-manager';

/**
 * 构造测试文档
 *
 * @param id - 文档 ID
 * @param content - 文档内容
 */
function makeDoc(id: string, content: string): Document {
  return { id, content, metadata: {} };
}

/**
 * 创建 Mock 向量存储
 */
function createMockStore(): VectorStore {
  return {
    upsert: vi.fn().mockResolvedValue(undefined),
    upsertByDocument: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByDocument: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * 创建 Mock 切块器（每个文档返回一个 chunk）
 */
function createMockChunker(): Chunker {
  return {
    chunk: vi.fn().mockImplementation((doc: Document): Chunk[] => [
      {
        id: `${doc.id}_chunk_0`,
        documentId: doc.id,
        content: doc.content,
        metadata: {},
      },
    ]),
  };
}

/**
 * 创建 Mock 嵌入提供商
 */
function createMockEmbedding(): EmbeddingProvider {
  return {
    embed: vi.fn().mockResolvedValue([0.1, 0.2]),
    embedBatch: vi.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => [0.1, 0.2]))
    ),
    dimension: 2,
  };
}

describe('IndexManager', () => {
  let store: VectorStore;
  let chunker: Chunker;
  let embedding: EmbeddingProvider;

  beforeEach(() => {
    store = createMockStore();
    chunker = createMockChunker();
    embedding = createMockEmbedding();
  });

  it('首次同步应新增所有文档', async () => {
    const manager = new IndexManager(store, chunker, embedding);
    const docs = [makeDoc('d1', '内容A'), makeDoc('d2', '内容B')];

    const report = await manager.sync(docs);

    expect(report.added).toBe(2);
    expect(report.updated).toBe(0);
    expect(report.deleted).toBe(0);
    expect(report.unchanged).toBe(0);

    // 应为每个文档调用 upsertByDocument
    expect(store.upsertByDocument).toHaveBeenCalledTimes(2);
    expect(store.upsertByDocument).toHaveBeenCalledWith(
      'd1',
      expect.arrayContaining([expect.objectContaining({ documentId: 'd1' })])
    );
    expect(store.upsertByDocument).toHaveBeenCalledWith(
      'd2',
      expect.arrayContaining([expect.objectContaining({ documentId: 'd2' })])
    );
  });

  it('内容不变时第二次同步应全部标记为未变化', async () => {
    const manager = new IndexManager(store, chunker, embedding);
    const docs = [makeDoc('d1', '内容A'), makeDoc('d2', '内容B')];

    await manager.sync(docs);

    // 第二次同步相同文档
    vi.mocked(store.upsertByDocument).mockClear();
    const report = await manager.sync(docs);

    expect(report.added).toBe(0);
    expect(report.updated).toBe(0);
    expect(report.deleted).toBe(0);
    expect(report.unchanged).toBe(2);

    // 不应再次写入
    expect(store.upsertByDocument).not.toHaveBeenCalled();
  });

  it('同步应检测到内容更新的文档', async () => {
    const manager = new IndexManager(store, chunker, embedding);
    const docs = [makeDoc('d1', '原始内容')];

    await manager.sync(docs);

    // 更新 d1 的内容
    vi.mocked(store.deleteByDocument).mockClear();
    vi.mocked(store.upsertByDocument).mockClear();
    const updatedDocs = [makeDoc('d1', '更新后的内容')];
    const report = await manager.sync(updatedDocs);

    expect(report.updated).toBe(1);
    expect(report.added).toBe(0);
    expect(report.unchanged).toBe(0);

    // 更新时应先删除旧数据，再写入新数据
    expect(store.deleteByDocument).toHaveBeenCalledWith('d1');
    expect(store.upsertByDocument).toHaveBeenCalledWith(
      'd1',
      expect.any(Array)
    );
  });

  it('同步应检测到已删除的文档', async () => {
    const manager = new IndexManager(store, chunker, embedding);
    const docs = [makeDoc('d1', '内容A'), makeDoc('d2', '内容B')];

    await manager.sync(docs);

    // 第二次同步时移除 d2
    vi.mocked(store.deleteByDocument).mockClear();
    const report = await manager.sync([makeDoc('d1', '内容A')]);

    expect(report.deleted).toBe(1);
    expect(report.unchanged).toBe(1);

    // 应对 d2 调用 deleteByDocument
    expect(store.deleteByDocument).toHaveBeenCalledWith('d2');
    // 不应对 d1 调用 deleteByDocument
    expect(store.deleteByDocument).not.toHaveBeenCalledWith('d1');
  });

  it('getHashSnapshot 应返回所有 Hash 记录', async () => {
    const manager = new IndexManager(store, chunker, embedding);
    const docs = [makeDoc('d1', '内容A'), makeDoc('d2', '内容B')];

    await manager.sync(docs);

    const snapshot = manager.getHashSnapshot();

    expect(snapshot).toHaveLength(2);
    const ids = snapshot.map((r) => r.documentId).sort();
    expect(ids).toEqual(['d1', 'd2']);
    // 每条记录应包含 hash 和 updatedAt
    snapshot.forEach((record) => {
      expect(record.hash).toBeTruthy();
      expect(record.updatedAt).toBeTruthy();
    });
  });

  it('restoreHashRecords 应替换现有记录', async () => {
    const manager = new IndexManager(store, chunker, embedding);

    // 先同步一条文档
    await manager.sync([makeDoc('d1', '内容A')]);
    expect(manager.getHashSnapshot()).toHaveLength(1);

    // 恢复外部记录
    const externalRecords = [
      { documentId: 'x1', hash: 'abc123', updatedAt: '2026-01-01T00:00:00Z' },
      { documentId: 'x2', hash: 'def456', updatedAt: '2026-01-02T00:00:00Z' },
    ];
    manager.restoreHashRecords(externalRecords);

    const snapshot = manager.getHashSnapshot();
    expect(snapshot).toHaveLength(2);
    const ids = snapshot.map((r) => r.documentId).sort();
    expect(ids).toEqual(['x1', 'x2']);

    // 原来的 d1 记录应已不存在
    expect(snapshot.find((r) => r.documentId === 'd1')).toBeUndefined();
  });
});
