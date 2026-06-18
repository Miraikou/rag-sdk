import type { LLMProvider, Retriever } from './types';
import { Logger } from './logger';

const logger = new Logger('Router');

/** 路由决策 */
export interface RouteDecision {
  type: string;
  retriever: Retriever;
  options?: Record<string, unknown>;
}

/** 路由规则 */
export interface RouteRule {
  name: string;
  match: (query: string) => boolean | Promise<boolean>;
  retriever: Retriever;
  options?: Record<string, unknown>;
}

/**
 * 检索路由器 — 根据查询内容选择最合适的检索策略
 *
 * 支持三种路由方式：
 * 1. 规则路由：基于关键词匹配
 * 2. LLM 路由：用 LLM 判断查询类型
 * 3. 自定义路由：用户提供 match 函数
 */
export class RetrievalRouter {
  private rules: RouteRule[];
  private defaultRetriever: Retriever;

  constructor(defaultRetriever: Retriever, rules: RouteRule[] = []) {
    this.defaultRetriever = defaultRetriever;
    this.rules = rules;
  }

  /** 添加路由规则 */
  addRule(rule: RouteRule): void {
    this.rules.push(rule);
  }

  /** 根据查询路由到合适的检索器 */
  async route(query: string): Promise<RouteDecision> {
    for (const rule of this.rules) {
      const matched = await rule.match(query);
      if (matched) {
        logger.debug(`Query routed to "${rule.name}"`);
        return {
          type: rule.name,
          retriever: rule.retriever,
          options: rule.options,
        };
      }
    }

    logger.debug('Query routed to default retriever');
    return {
      type: 'default',
      retriever: this.defaultRetriever,
    };
  }

  /** 创建基于 LLM 的路由规则 */
  static createLLMRule(
    llm: LLMProvider,
    name: string,
    retriever: Retriever,
    description: string,
  ): RouteRule {
    return {
      name,
      retriever,
      match: async (query: string) => {
        const response = await llm.chat([
          {
            role: 'system',
            content: `判断以下问题是否属于"${description}"类型。只回答 yes 或 no。`,
          },
          { role: 'user', content: query },
        ]);
        return response.trim().toLowerCase().startsWith('yes');
      },
    };
  }
}
