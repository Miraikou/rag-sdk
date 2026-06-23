import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BaseLoader } from './base';
import type { Document, JSONLoaderOptions } from '../types';

/**
 * JSON 加载器
 *
 * 加载 JSON 文件，支持通过路径提取嵌套字段。
 * 如果提取的内容是数组，每个元素生成一个 Document。
 */
export class JSONLoader extends BaseLoader {
  private readonly options: JSONLoaderOptions;

  /**
   * @param options - 加载选项
   * @param options.contentPath - 提取内容的字段路径（如 "data.items"）
   * @param options.metadataPaths - 提取为元数据的字段路径列表
   */
  constructor(options?: JSONLoaderOptions) {
    super();
    this.options = options ?? {};
  }

  /**
   * 加载 JSON 文件
   *
   * @param source - 文件路径字符串或 Buffer
   * @returns 文档数组
   */
  async load(source: string | Buffer): Promise<Document[]> {
    const raw = Buffer.isBuffer(source)
      ? source.toString('utf-8')
      : await readFile(resolve(source), 'utf-8');

    const parsed: unknown = JSON.parse(raw);

    // 提取内容
    const contentTarget = this.options.contentPath
      ? this.getByPath(parsed, this.options.contentPath)
      : parsed;

    // 如果内容是数组，每个元素生成一个 Document
    if (Array.isArray(contentTarget)) {
      return contentTarget.map((item, index) => ({
        id: this.generateId(),
        content: typeof item === 'string' ? item : JSON.stringify(item, null, 2),
        metadata: {
          source: String(source),
          loader: 'JSONLoader',
          format: 'json',
          index,
          ...this.extractMetadata(parsed),
        },
      }));
    }

    return [
      {
        id: this.generateId(),
        content: typeof contentTarget === 'string'
          ? contentTarget
          : JSON.stringify(contentTarget, null, 2),
        metadata: {
          source: String(source),
          loader: 'JSONLoader',
          format: 'json',
          ...this.extractMetadata(parsed),
        },
      },
    ];
  }

  /**
   * 按路径提取嵌套字段
   *
   * @param obj - 目标对象
   * @param path - 点号分隔的路径（如 "data.items"）
   * @returns 提取到的值
   */
  private getByPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * 提取指定的元数据字段
   *
   * @param parsed - 完整的 JSON 对象
   * @returns 提取到的元数据键值对
   */
  private extractMetadata(parsed: unknown): Record<string, unknown> {
    if (!this.options.metadataPaths) return {};
    const metadata: Record<string, unknown> = {};
    for (const path of this.options.metadataPaths) {
      const value = this.getByPath(parsed, path);
      if (value !== undefined) {
        metadata[path] = value;
      }
    }
    return metadata;
  }
}
