import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../src/openai';

describe('OpenAIProvider', () => {
	const apiKey = process.env.OPENAI_API_KEY ?? 'test-key';
	const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
	const testModel = process.env.TEST_MODEL ?? 'gpt-4o-mini';

	it('should create instance with config', () => {
		const provider = new OpenAIProvider({
			apiKey,
			baseUrl,
			defaultModel: testModel,
		});
		expect(provider).toBeDefined();
	});

	it('should throw on empty messages', async () => {
		const provider = new OpenAIProvider({
			apiKey,
			baseUrl,
			defaultModel: testModel,
		});
		await expect(provider.chat([])).rejects.toThrow(
			'messages must not be empty',
		);
	});

	it('should get valid response from chat', async () => {
		if (!process.env.OPENAI_API_KEY) return;

		const provider = new OpenAIProvider({
			apiKey,
			baseUrl,
			defaultModel: testModel,
		});

		const answer = await provider.chat([
			{ role: 'user', content: '请用一句话回答：1+1等于几？' },
		]);

		console.log('[chat] 响应:', answer);

		expect(typeof answer).toBe('string');
		expect(answer.length).toBeGreaterThan(0);
	}, 15000);

	it('should get valid response from chatStream', async () => {
		if (!process.env.OPENAI_API_KEY) return;

		const provider = new OpenAIProvider({
			apiKey,
			baseUrl,
			defaultModel: testModel,
		});

		const chunks: string[] = [];
		for await (const chunk of provider.chatStream([
			{ role: 'user', content: '请用一句话回答：中国的首都是哪里？' },
		])) {
			chunks.push(chunk);
		}

		const fullText = chunks.join('');
		console.log('[chatStream] chunk数:', chunks.length);
		console.log('[chatStream] 完整响应:', fullText);

		expect(chunks.length).toBeGreaterThan(0);
		expect(fullText.length).toBeGreaterThan(0);
	}, 15000);

	it('should have chatJson method', () => {
		const provider = new OpenAIProvider({ apiKey: 'test-key' });
		expect(typeof provider.chatJson).toBe('function');
	});
});
