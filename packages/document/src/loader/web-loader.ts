import { BaseLoader } from './base';
import type { Document, WebLoaderOptions } from '../types';

/**
 * 网页加载器
 *
 * 从 URL 加载网页内容，自动提取正文并去除导航栏、广告等非内容元素。
 * 依赖 `cheerio` 库进行 HTML 解析（需要用户自行安装）。
 * 也支持直接传入 HTML 字符串（Buffer）进行解析。
 *
 * @example
 * ```ts
 * // 需要先安装 cheerio
 * // pnpm add cheerio
 * const loader = new WebLoader({ selector: 'article' });
 * const docs = await loader.load('https://example.com/blog/post');
 * ```
 */
export class WebLoader extends BaseLoader {
  private readonly selector: string;
  private readonly includeImageAlt: boolean;
  private readonly timeout: number;

  /**
   * @param options - 加载选项
   * @param options.selector - 提取正文的 CSS 选择器，默认 'body'
   * @param options.includeImageAlt - 是否保留图片 alt 文本，默认 false
   * @param options.timeout - 请求超时时间（毫秒），默认 30000
   */
  constructor(options?: WebLoaderOptions) {
    super();
    this.selector = options?.selector ?? 'body';
    this.includeImageAlt = options?.includeImageAlt ?? false;
    this.timeout = options?.timeout ?? 30000;
  }

  /**
   * 加载网页内容
   *
   * @param source - URL 字符串或 HTML Buffer
   * @returns 包含提取正文的文档数组
   */
  async load(source: string | Buffer): Promise<Document[]> {
    if (Buffer.isBuffer(source)) {
      return this.parseHTML(source.toString('utf-8'), 'buffer');
    }

    // source 为 URL
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(source, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const html = await response.text();
      return this.parseHTML(html, source);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 解析 HTML 并提取正文内容
   *
   * @param html - 原始 HTML 字符串
   * @param source - 来源标识（URL 或 'buffer'）
   * @returns 包含提取正文的文档数组
   */
  private async parseHTML(html: string, source: string): Promise<Document[]> {
    let cheerio: typeof import('cheerio');

    try {
      cheerio = await import('cheerio');
    } catch {
      throw new Error(
        'WebLoader 需要安装 cheerio 依赖：pnpm add cheerio'
      );
    }

    const $ = cheerio.load(html);

    // 移除脚本、样式、导航等非内容元素
    $('script, style, nav, footer, header, aside').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim();
    const element = $(this.selector);
    const content = element.text().replace(/\s+/g, ' ').trim();

    const metadata: Record<string, unknown> = {
      source,
      loader: 'WebLoader',
      format: 'html',
      title,
    };

    // 提取 meta 信息
    const description = $('meta[name="description"]').attr('content');
    if (description) metadata['description'] = description;

    const keywords = $('meta[name="keywords"]').attr('content');
    if (keywords) metadata['keywords'] = keywords;

    if (this.includeImageAlt) {
      const imageAlts = $('img')
        .map((_, el) => $(el).attr('alt'))
        .get()
        .filter(Boolean);
      if (imageAlts.length > 0) metadata['imageAlts'] = imageAlts;
    }

    return [
      {
        id: this.generateId(),
        content,
        metadata,
      },
    ];
  }
}
