import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // 工作区包别名 — 让 vitest 从 tests/ 和任意目录解析 @ragsdk/* 包
      '@ragsdk/core': resolve(__dirname, 'packages/core/src'),
      '@ragsdk/llm': resolve(__dirname, 'packages/llm/src'),
      '@ragsdk/embedding': resolve(__dirname, 'packages/embedding/src'),
      '@ragsdk/storage': resolve(__dirname, 'packages/storage/src'),
      '@ragsdk/document': resolve(__dirname, 'packages/document/src'),
      '@ragsdk/retrieval': resolve(__dirname, 'packages/retrieval/src'),
      '@ragsdk/generation': resolve(__dirname, 'packages/generation/src'),
      '@ragsdk/indexing': resolve(__dirname, 'packages/indexing/src'),
      '@ragsdk/evaluation': resolve(__dirname, 'packages/evaluation/src'),
      '@ragsdk/knowledge-graph': resolve(__dirname, 'packages/knowledge-graph/src'),
      // 适配器包
      '@ragsdk/llm-anthropic': resolve(__dirname, 'packages/llm-anthropic/src'),
      '@ragsdk/llm-google': resolve(__dirname, 'packages/llm-google/src'),
      '@ragsdk/embedding-anthropic': resolve(__dirname, 'packages/embedding-anthropic/src'),
      '@ragsdk/embedding-google': resolve(__dirname, 'packages/embedding-google/src'),
      '@ragsdk/embedding-voyage': resolve(__dirname, 'packages/embedding-voyage/src'),
      '@ragsdk/storage-pinecone': resolve(__dirname, 'packages/storage-pinecone/src'),
      '@ragsdk/storage-weaviate': resolve(__dirname, 'packages/storage-weaviate/src'),
      '@ragsdk/storage-chroma': resolve(__dirname, 'packages/storage-chroma/src'),
      '@ragsdk/storage-qdrant': resolve(__dirname, 'packages/storage-qdrant/src'),
      '@ragsdk/storage-pgvector': resolve(__dirname, 'packages/storage-pgvector/src'),
      // 伞包
      'rag-sdk': resolve(__dirname, 'packages/rag-sdk/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/*/__tests__/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        '**/demo/**',
      ],
    },
  },
});
