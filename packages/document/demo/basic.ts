/**
 * @rag-sdk/document 基础用法示例
 *
 * 运行: npx tsx packages/document/demo/basic.ts
 */

import {
  FixedSizeChunker,
  RecursiveChunker,
  SemanticChunker,
  MarkdownChunker,
  ContextualHeaderChunker,
  TextLoader,
  MarkdownLoader,
  JSONLoader,
  CSVLoader,
  DocumentCleaner,
} from '../src/index';

// ==================== 文档加载器 ====================

console.log('=== 文档加载器 ===\n');

// 文本加载器
const textLoader = new TextLoader();
const textDocs = await textLoader.load('Hello, world!');
console.log(`TextLoader: 加载了 ${textDocs.length} 个文档`);
console.log(`  内容: "${textDocs[0]?.content}"\n`);

// Markdown 加载器
const mdLoader = new MarkdownLoader();
const mdDocs = await mdLoader.load('# 标题\n\n这是一段 **Markdown** 文本。');
console.log(`MarkdownLoader: 加载了 ${mdDocs.length} 个文档`);
console.log(`  内容: "${mdDocs[0]?.content}"\n`);

// JSON 加载器
const jsonLoader = new JSONLoader();
const jsonDocs = await jsonLoader.load(JSON.stringify({
  title: '测试文档',
  content: '这是一段 JSON 内容。',
}));
console.log(`JSONLoader: 加载了 ${jsonDocs.length} 个文档\n`);

// CSV 加载器
const csvLoader = new CSVLoader();
const csvDocs = await csvLoader.load('name,age,city\n张三,30,北京\n李四,25,上海');
console.log(`CSVLoader: 加载了 ${csvDocs.length} 个文档`);
csvDocs.forEach((doc) => {
  console.log(`  - ${doc.id}: ${JSON.stringify(doc.metadata)}`);
});

// ==================== 文档清洗 ====================

console.log('\n=== 文档清洗 ===\n');

const cleaner = new DocumentCleaner();
const dirtyDoc = { id: '1', content: '  有多余空格  \n\n\n\n多余空行\n\n', metadata: {} };
const cleanedDocs = await cleaner.clean([dirtyDoc]);
console.log(`清洗前: "${dirtyDoc.content.replace(/\n/g, '\\n')}"`);
console.log(`清洗后: "${cleanedDocs[0]?.content.replace(/\n/g, '\\n')}"`);

// ==================== 切块策略 ====================

console.log('\n=== 切块策略 ===\n');

const sampleDoc = {
  id: 'doc-1',
  content: '第一章：引言\n\n这是引言部分的内容。\n\n第二章：方法\n\n这里描述了研究方法。\n\n第三章：结果\n\n实验结果展示如下。',
  metadata: { title: '示例文档' },
};

// 固定大小切块
console.log('--- 固定大小切块 (chunkSize=50, overlap=10) ---');
const fixedChunker = new FixedSizeChunker({ chunkSize: 50, overlap: 10 });
const fixedChunks = fixedChunker.chunk(sampleDoc);
fixedChunks.forEach((c) => {
  console.log(`  [${c.id}] "${c.content.substring(0, 60)}..."`);
});

// 递归切块
console.log('\n--- 递归切块 (chunkSize=80) ---');
const recursiveChunker = new RecursiveChunker();
const recursiveChunks = recursiveChunker.chunk(sampleDoc, { chunkSize: 80 });
recursiveChunks.forEach((c) => {
  console.log(`  [${c.id}] "${c.content.substring(0, 60)}..."`);
});

// Markdown 切块
console.log('\n--- Markdown 切块 ---');
const mdChunker = new MarkdownChunker();
const mdContent = '# 标题\n\n## 子标题 1\n内容 1\n\n## 子标题 2\n内容 2';
const mdDoc = { id: 'md-1', content: mdContent, metadata: {} };
const mdChunks = mdChunker.chunk(mdDoc);
mdChunks.forEach((c) => {
  console.log(`  [${c.id}] header="${c.contextHeader ?? ''}" content="${c.content}"`);
});

// 语义切块
console.log('\n--- 语义切块 ---');
const semanticChunker = new SemanticChunker({
  embedding: {
    dimension: 3,
    embed: async () => [0.1, 0.2, 0.3],
    embedBatch: async () => [[0.1, 0.2, 0.3]],
  },
});
const semanticChunks = semanticChunker.chunk(sampleDoc, { chunkSize: 100 });
console.log(`  生成了 ${semanticChunks.length} 个 chunks`);

// 上下文头切块
console.log('\n--- 上下文头切块 ---');
const ctxChunker = new ContextualHeaderChunker({
  llm: {
    chat: async () => '文档摘要',
    chatStream: async function* () { yield ''; },
    chatJson: async <T>(_messages: unknown[], _schema: Record<string, unknown>): Promise<T> => ({}) as unknown as T,
  },
  innerChunker: new FixedSizeChunker(),
});
const ctxChunks = ctxChunker.chunk(mdDoc);
ctxChunks.forEach((c) => {
  console.log(`  [${c.id}] header="${c.contextHeader ?? ''}" content="${c.content.substring(0, 50)}"`);
});
