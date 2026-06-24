/**
 * @rag-sdk/embedding 基础用法示例
 *
 * 运行: npx tsx packages/embedding/demo/basic.ts
 *
 * 需要设置环境变量 OPENAI_API_KEY
 */
import 'dotenv/config';
import { OpenAIEmbeddingProvider } from '../src/index';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  请设置环境变量 OPENAI_API_KEY 以运行完整示例');
    console.log('   export OPENAI_API_KEY=sk-xxxxx\n');
  }

  // ==================== 创建 Provider ====================

  console.log('=== 创建 OpenAIEmbeddingProvider ===\n');

  const provider = new OpenAIEmbeddingProvider({
    apiKey: apiKey ?? 'test-key',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.TEST_MODEL,
    dimension: 2048,
  });

  console.log('Provider 已创建');
  console.log(`模型: ${process.env.TEST_MODEL}`);
  console.log(`维度: ${provider.dimension}\n`);

  if (!apiKey) {
    console.log('（跳过需要 API Key 的实际调用）');
    return;
  }

  // ==================== 单条嵌入 ====================

  console.log('=== 单条文本嵌入 ===\n');

  const text = 'RAG（检索增强生成）是一种结合检索和生成的 AI 技术架构。';
  const embedding = await provider.embed(text);

  console.log(`输入文本: "${text}"`);
  console.log(`向量维度: ${embedding.length}`);
  console.log(`前 5 个值: [${embedding.slice(0, 5).map((v) => v.toFixed(6)).join(', ')}]\n`);

  // ==================== 批量嵌入 ====================

  console.log('=== 批量文本嵌入 ===\n');

  const texts = [
    '什么是向量数据库？',
    'Embedding 是如何工作的？',
    '余弦相似度是什么？',
  ];

  const embeddings = await provider.embedBatch(texts);

  console.log(`批量嵌入 ${texts.length} 条文本`);
  embeddings.forEach((emb, i) => {
    console.log(`  [${i}] "${texts[i]}" → ${emb.length} 维向量`);
  });

  // ==================== 相似度计算 ====================

  console.log('\n=== 向量相似度计算 ===\n');

  const cosineSimilarity = (a: number[], b: number[]): number => {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const sim01 = cosineSimilarity(embeddings[0]!, embeddings[1]!);
  const sim02 = cosineSimilarity(embeddings[0]!, embeddings[2]!);

  console.log(`"${texts[0]}" 与 "${texts[1]}" 相似度: ${sim01.toFixed(4)}`);
  console.log(`"${texts[0]}" 与 "${texts[2]}" 相似度: ${sim02.toFixed(4)}`);
}

main().catch(console.error);
