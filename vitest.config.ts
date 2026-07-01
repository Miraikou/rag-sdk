import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // 工作区包别名 — 让 vitest 从 tests/ 和任意目录解析 @rag-sdk/* 包
      '@rag-sdk/core': resolve(__dirname, 'packages/core/src'),
      '@rag-sdk/llm': resolve(__dirname, 'packages/llm/src'),
      '@rag-sdk/embedding': resolve(__dirname, 'packages/embedding/src'),
      '@rag-sdk/storage': resolve(__dirname, 'packages/storage/src'),
      '@rag-sdk/document': resolve(__dirname, 'packages/document/src'),
      '@rag-sdk/retrieval': resolve(__dirname, 'packages/retrieval/src'),
      '@rag-sdk/generation': resolve(__dirname, 'packages/generation/src'),
      '@rag-sdk/indexing': resolve(__dirname, 'packages/indexing/src'),
      '@rag-sdk/evaluation': resolve(__dirname, 'packages/evaluation/src'),
      '@rag-sdk/knowledge-graph': resolve(__dirname, 'packages/knowledge-graph/src'),
      // 适配器包
      '@rag-sdk/llm-anthropic': resolve(__dirname, 'packages/llm-anthropic/src'),
      '@rag-sdk/llm-google': resolve(__dirname, 'packages/llm-google/src'),
      '@rag-sdk/embedding-anthropic': resolve(__dirname, 'packages/embedding-anthropic/src'),
      '@rag-sdk/embedding-google': resolve(__dirname, 'packages/embedding-google/src'),
      '@rag-sdk/embedding-voyage': resolve(__dirname, 'packages/embedding-voyage/src'),
      '@rag-sdk/storage-pinecone': resolve(__dirname, 'packages/storage-pinecone/src'),
      '@rag-sdk/storage-weaviate': resolve(__dirname, 'packages/storage-weaviate/src'),
      '@rag-sdk/storage-chroma': resolve(__dirname, 'packages/storage-chroma/src'),
      '@rag-sdk/storage-qdrant': resolve(__dirname, 'packages/storage-qdrant/src'),
      '@rag-sdk/storage-pgvector': resolve(__dirname, 'packages/storage-pgvector/src'),
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
