/**
 * @rag-sdk/storage-chroma 基础用法示例
 *
 * 运行前请先启动 Chroma 服务：
 *   docker run -p 8000:8000 chromadb/chroma
 *   或本地安装: chroma run --path ./chroma-data
 *
 * 运行: npx tsx packages/storage-chroma/demo/basic.ts
 *
 * 环境变量（可选，在项目根目录 .env 中配置）：
 *   CHROMA_BASE_URL  - Chroma 服务地址（默认 http://localhost:8000）
 */
import 'dotenv/config'
import { ChromaStore } from '../src/index'
import type { Chunk, SearchOptions } from '@rag-sdk/core'

async function main(): Promise<void> {
  const baseUrl = process.env.CHROMA_BASE_URL ?? 'http://localhost:8000'

  console.log('=== Chroma 向量存储示例 ===\n')
  console.log(`Chroma 地址: ${baseUrl}\n`)

  // ==================== 创建 Store ====================

  const store = new ChromaStore({
    baseUrl,
    collectionName: 'demo_chunks',
  })

  // ==================== 准备测试数据 ====================

  // 使用确定性向量模拟 embedding（3 维便于观察）
  const chunks: Chunk[] = [
    {
      id: 'chunk-1',
      documentId: 'doc-1',
      content: 'RAG 结合了检索和生成两种技术，有效减少大模型幻觉。',
      metadata: { topic: 'AI', category: 'overview', author: 'zhangsan' },
      embedding: [1.0, 0.0, 0.0],
    },
    {
      id: 'chunk-2',
      documentId: 'doc-1',
      content: '向量数据库用于存储和检索高维向量，支持近似最近邻搜索。',
      metadata: { topic: 'AI', category: 'database', author: 'zhangsan' },
      embedding: [0.0, 1.0, 0.0],
    },
    {
      id: 'chunk-3',
      documentId: 'doc-2',
      content: 'Embedding 模型将文本转换为稠密向量表示，如 OpenAI text-embedding-3-small。',
      metadata: { topic: 'AI', category: 'embedding', author: 'lisi' },
      embedding: [0.0, 0.0, 1.0],
    },
    {
      id: 'chunk-4',
      documentId: 'doc-2',
      content: '常见的切块策略包括固定大小切块、语义切块、递归切块等。',
      metadata: { topic: 'AI', category: 'chunking', author: 'lisi' },
      embedding: [0.7, 0.7, 0.0],
    },
    {
      id: 'chunk-5',
      documentId: 'doc-3',
      content: '检索后处理可以提升结果质量，如重排序、上下文压缩等。',
      metadata: { topic: 'AI', category: 'retrieval', author: 'wangwu' },
      embedding: [0.3, 0.6, 0.0],
    },
  ]

  // ==================== 存储 chunks ====================

  console.log('=== upsert 存储 ===\n')

  try {
    await store.upsert(chunks)
    console.log(`已存储 ${chunks.length} 个 chunks 到集合 "demo_chunks"\n`)
  } catch (err) {
    console.log('❌ 连接 Chroma 失败，请确保 Chroma 服务已启动')
    console.log(`   docker run -p 8000:8000 chromadb/chroma\n`)
    console.log(`错误详情: ${err instanceof Error ? err.message : String(err)}`)
    return
  }

  // ==================== 向量搜索 ====================

  console.log('=== search 向量搜索 ===\n')

  // 查询与 "RAG" 最相关的 chunks（向量偏 [1,0,0] 方向）
  const results = await store.search([1.0, 0.0, 0.0], { topK: 3 })
  console.log('查询向量: [1.0, 0.0, 0.0]（偏向 RAG 相关内容）')
  console.log(`返回 Top-${3} 结果:`)
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.chunk.id}] score=${r.score.toFixed(4)} content="${r.chunk.content.slice(0, 40)}..."`)
  })

  // 混合向量查询
  console.log('\n查询向量: [0.5, 0.5, 0.0]（数据库 + RAG 混合）')
  const mixedResults = await store.search([0.5, 0.5, 0.0], { topK: 3 })
  mixedResults.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.chunk.id}] score=${r.score.toFixed(4)} content="${r.chunk.content.slice(0, 40)}..."`)
  })

  // ==================== 阈值过滤 ====================

  console.log('\n=== threshold 阈值过滤 ===\n')

  const thresholdResults = await store.search([1.0, 0.0, 0.0], { topK: 10, threshold: 0.9 })
  console.log(`阈值 0.9，结果数: ${thresholdResults.length}`)
  thresholdResults.forEach((r) => {
    console.log(`  [${r.chunk.id}] score=${r.score.toFixed(4)}`)
  })

  // ==================== metadata 过滤 ====================

  console.log('\n=== filter 元数据过滤 ===\n')

  // 按 category 过滤
  const categoryResults = await store.search([0.7, 0.7, 0.0], {
    filter: { category: 'chunking' },
  } as SearchOptions)
  console.log('过滤条件: category=chunking')
  categoryResults.forEach((r) => {
    console.log(`  [${r.chunk.id}] category=${r.chunk.metadata['category']} content="${r.chunk.content.slice(0, 40)}..."`)
  })

  // 按 author 过滤
  const authorResults = await store.search([0.0, 0.0, 1.0], {
    filter: { author: 'lisi' },
  } as SearchOptions)
  console.log('\n过滤条件: author=lisi')
  authorResults.forEach((r) => {
    console.log(`  [${r.chunk.id}] author=${r.chunk.metadata['author']}`)
  })

  // ==================== 按文档替换 ====================

  console.log('\n=== upsertByDocument 按文档替换 ===\n')

  const updatedChunks: Chunk[] = [
    {
      id: 'doc-3-chunk-new',
      documentId: 'doc-3',
      content: '重排序（Reranker）使用交叉编码器对候选结果精排，显著提升检索精度。',
      metadata: { topic: 'AI', category: 'retrieval', author: 'wangwu', version: 'v2' },
      embedding: [0.4, 0.7, 0.1],
    },
  ]

  await store.upsertByDocument('doc-3', updatedChunks)
  console.log('doc-3 已替换为新版本（新增 version=v2 字段）')

  const doc3Results = await store.search([0.3, 0.6, 0.0])
  console.log(`doc-3 搜索结果: ${doc3Results.length} 条`)
  doc3Results.forEach((r) => {
    console.log(`  [${r.chunk.id}] version=${r.chunk.metadata['version'] ?? '无'} content="${r.chunk.content.slice(0, 40)}..."`)
  })

  // ==================== 删除操作 ====================

  console.log('\n=== delete 删除操作 ===\n')

  // 按 ID 删除
  await store.delete(['chunk-1'])
  console.log('已删除 chunk-1')

  const afterIdDelete = await store.search([1.0, 0.0, 0.0])
  console.log(`删除后搜索结果: ${afterIdDelete.length} 条`)

  // 按文档 ID 删除
  await store.deleteByDocument('doc-2')
  console.log('已删除 doc-2 的所有 chunks')

  const afterDocDelete = await store.search([0.0, 0.0, 1.0])
  console.log(`删除后 doc-2 结果: ${afterDocDelete.length} 条`)
}

main().catch(console.error)
