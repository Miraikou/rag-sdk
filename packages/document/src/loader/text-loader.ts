import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BaseLoader } from './base';
import type { Document, TextLoaderOptions } from '../types';

/**
 * 纯文本加载器
 *
 * 加载 .txt 纯文本文件，支持自定义编码。
 * 支持文件路径和 Buffer 两种输入方式。
 */
export class TextLoader extends BaseLoader {
  private readonly encoding: BufferEncoding;

  /**
   * @param options - 加载选项
   * @param options.encoding - 文件编码，默认 utf-8
   */
  constructor(options?: TextLoaderOptions) {
    super();
    this.encoding = options?.encoding ?? 'utf-8';
  }

  /**
   * 加载纯文本文件
   *
   * @param source - 文件路径字符串或 Buffer
   * @returns 包含一个 Document 的数组
   */
  async load(source: string | Buffer): Promise<Document[]> {
    let content: string;
    let filename: string;

    if (Buffer.isBuffer(source)) {
      content = source.toString(this.encoding);
      filename = 'buffer';
    } else {
      const filePath = resolve(source);
      content = await readFile(filePath, { encoding: this.encoding });
      filename = filePath;
    }

    return [
      {
        id: this.generateId(),
        content,
        metadata: {
          source: filename,
          loader: 'TextLoader',
          createdAt: new Date().toISOString(),
        },
      },
    ];
  }
}
