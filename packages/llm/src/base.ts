import type { ChatOptions, LLMProvider, Message } from '@ragsdk/core';
import type { JsonOutputMode, LLMConfig } from './types';

/** Provider 能力声明接口，子类通过 override 声明自身能力 */
export interface ProviderCapabilities {
	/**
	 * 当前 Provider 支持的最佳 JSON 输出模式
	 * 基类会按此选择实际发送给 API 的 response_format
	 */
	readonly jsonOutputMode: JsonOutputMode;
}

export class JsonParseError extends Error {
	constructor(
		public readonly raw: string,
		public readonly providerName: string,
		cause: unknown,
	) {
		super(
			`[${providerName}] chatJson: JSON.parse failed.\n` +
				`Cause: ${cause instanceof Error ? cause.message : String(cause)}\n` +
				`Raw response (first 500 chars): ${raw.slice(0, 500)}`,
		);
		this.name = 'JsonParseError';
		// 保留原始 cause，Node 18+ / 现代浏览器支持
		if (cause instanceof Error) {
			this.cause = cause;
		}
	}
}

/** LLM 提供商抽象基类 */
export abstract class BaseLLMProvider implements LLMProvider {
	protected config: LLMConfig;

	constructor(config: LLMConfig) {
		this.config = config;
	}

	abstract chat(messages: Message[], options?: ChatOptions): Promise<string>;
	abstract chatStream(
		messages: Message[],
		options?: ChatOptions,
	): AsyncIterable<string>;

	/**
	 * 子类声明自身支持的 JSON 输出模式。
	 * 默认 'json_object'，兼容大多数 OpenAI-compatible provider（含 DeepSeek）。
	 * 支持 Structured Outputs 的 provider（如 OpenAI）可覆写为 'json_schema'。
	 */
	get jsonOutputMode(): JsonOutputMode {
		return 'json_object';
	}

	/**
	 * 结构化输出：返回符合 JSON Schema 的 parsed 对象
	 *
	 * 流程：
	 * 1. 根据 `jsonOutputMode` 构造 provider 实际能接受的 responseFormat
	 * 2. 当模式为 'json_object' 或 'prompt_only' 时，将 schema 注入 system prompt 作为补偿
	 * 3. 调用 chat()，对原始文本做清洗（去除 markdown fence），再 JSON.parse
	 * 4. 解析失败时抛出携带上下文的 JsonParseError
	 *
	 * 子类若有原生 Structured Outputs 能力（如 tool_calls hack），可完整覆写此方法。
	 *
	 * @param messages - 对话消息列表
	 * @param schema - 标准 JSON Schema 对象
	 * @param options - 调用选项
	 * @returns 符合 schema 的类型安全对象
	 */
	async chatJson<T = unknown>(
		messages: Message[],
		schema: Record<string, unknown>,
		options?: ChatOptions,
	): Promise<T> {
		// options.responseFormat.type 优先于 provider 默认的 jsonOutputMode
		const mode = (options?.responseFormat?.type as JsonOutputMode | undefined) ?? this.jsonOutputMode;
		const { enrichedMessages, resolvedOptions } = this.buildJsonRequest(
			messages,
			schema,
			mode,
			options,
		);

		const raw = await this.chat(enrichedMessages, resolvedOptions);
		return this.parseJsonResponse<T>(raw, schema);
	}

	/**
	 * 根据 provider 能力，构造实际的 messages + options
	 *
	 * - json_schema  → 直接透传 schema 到 responseFormat，messages 不变
	 * - json_object  → responseFormat 只设 json_object，schema 序列化注入 system prompt
	 * - prompt_only  → 不设 responseFormat，schema 注入 system prompt
	 */
	protected buildJsonRequest(
		messages: Message[],
		schema: Record<string, unknown>,
		mode: JsonOutputMode,
		options?: ChatOptions,
	): { enrichedMessages: Message[]; resolvedOptions: ChatOptions } {
		if (mode === 'json_schema') {
			return {
				enrichedMessages: messages,
				resolvedOptions: {
					...this.mergeOptions(options),
					responseFormat: {
						type: 'json_schema',
						name: options?.responseFormat?.name ?? 'output',
						schema,
					},
				},
			};
		}

		// json_object / prompt_only：schema 通过 prompt 传递
		const schemaInstruction = this.buildSchemaPrompt(schema);
		const enrichedMessages = this.injectSystemPrompt(
			messages,
			schemaInstruction,
		);

		const resolvedOptions: ChatOptions = {
			...this.mergeOptions(options),
			...(mode === 'json_object'
				? { responseFormat: { type: 'json_object' } }
				: {}),
		};

		return { enrichedMessages, resolvedOptions };
	}

	/**
	 * 将 schema 序列化为 system prompt 指令
	 * 使用 json_object 模式时，prompt 中必须出现 "json"（DeepSeek 等 provider 的硬性要求）
	 */
	protected buildSchemaPrompt(schema: Record<string, unknown>): string {
		return [
			'You must respond with valid JSON only. Do not include markdown, prose, or code fences.',
			'Your response must conform to the following JSON Schema:',
			'```json',
			JSON.stringify(schema, null, 2),
			'```',
		].join('\n');
	}

	/**
	 * 将 schema 指令注入到 system message。
	 * 若已存在 system message，追加到末尾；否则在头部插入新 system message。
	 */
	protected injectSystemPrompt(
		messages: Message[],
		instruction: string,
	): Message[] {
		const systemIndex = messages.findIndex((m) => m.role === 'system');

		if (systemIndex !== -1) {
			// 追加，避免破坏用户原有 system prompt 的意图
			const existing = messages[systemIndex]
			if (!existing) return messages
			const updated = [...messages]
			updated[systemIndex] = {
				role: existing.role,
				content: `${existing.content}\n\n${instruction}`,
			}
			return updated
		}

		return [{ role: 'system', content: instruction }, ...messages];
	}

	/**
	 * 清洗模型原始响应并 JSON.parse
	 * 处理常见污染：```json ... ``` fence、前后空白
	 */
	protected parseJsonResponse<T>(
		raw: string,
		_schema?: Record<string, unknown>,
	): T {
		const cleaned = raw
			.trim()
			.replace(/^```(?:json)?\s*/i, '')
			.replace(/\s*```$/, '')
			.trim();

		try {
			return JSON.parse(cleaned) as T;
		} catch (cause) {
			throw new JsonParseError(raw, this.constructor.name, cause);
		}
	}

	protected mergeOptions(options?: ChatOptions): ChatOptions {
		return { ...this.config.defaultOptions, ...options };
	}

	protected get baseUrl(): string {
		return this.config.baseUrl ?? 'https://api.openai.com/v1';
	}

	protected get headers(): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${this.config.apiKey}`,
		};
	}
}
