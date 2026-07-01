/**
 * @ragsdk/llm 基础用法示例
 *
 * 运行: npx tsx packages/llm/demo/basic.ts
 *
 * 需要设置环境变量 OPENAI_API_KEY
 */
import 'dotenv/config'
import { OpenAIProvider } from '../src/index';

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  请设置环境变量 OPENAI_API_KEY 以运行完整示例');
    console.log('   export OPENAI_API_KEY=sk-xxxxx\n');
  }

  // ==================== 创建 Provider ====================

  console.log('=== 创建 OpenAIProvider ===\n');

  const provider = new OpenAIProvider({
    apiKey: apiKey ?? 'test-key',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    defaultModel: process.env.TEST_MODEL ?? 'gpt-4o-mini',
    defaultOptions: {
      temperature: 0.7,
      maxTokens: 1024,
    },
  });

  console.log('Provider 已创建');
  console.log(`模型: ${process.env.TEST_MODEL ?? 'gpt-4o-mini'}\n`);

  if (!apiKey) {
    console.log('（跳过需要 API Key 的实际调用）');
    return;
  }

  // ==================== 基础对话 ====================

  console.log('=== 基础对话 ===\n');

  const answer = await provider.chat([
    { role: 'system', content: '你是一个简洁的助手，用一句话回答问题。' },
    { role: 'user', content: '什么是 RAG？' },
  ]);

  console.log('回答:', answer);
  console.log();

  // ==================== 流式对话 ====================

  console.log('=== 流式对话 ===\n');

  process.stdout.write('回答: ');
  for await (const chunk of provider.chatStream([
    { role: 'user', content: '用一句话介绍 TypeScript。' },
  ])) {
    process.stdout.write(chunk);
  }
  console.log('\n');

  // ==================== 结构化输出（json_object 模式，默认） ====================

  console.log('=== 结构化输出（chatJson）===\n');

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      skills: { type: 'array', items: { type: 'string' } },
    },
    required: ['name', 'age', 'skills'],
  };

  const person = await provider.chatJson<{ name: string; age: number; skills: string[] }>(
    [{ role: 'user', content: '生成一个虚构的人物信息 JSON。' }],
    schema,
    { temperature: 0.3, responseFormat: { type: 'json_object' } },
  );

  console.log('结构化输出:', JSON.stringify(person, null, 2));
}

main().catch(console.error);
