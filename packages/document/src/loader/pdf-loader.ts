import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BaseLoader } from './base';
import type { Document, PDFLoaderOptions } from '../types';

/**
 * PDF 加载器
 *
 * 加载 PDF 文件，支持按页拆分。
 * 依赖 `pdf-parse` 库进行 PDF 解析（需要用户自行安装）。
 *
 * @example
 * ```ts
 * // 需要先安装 pdf-parse
 * // pnpm add pdf-parse
 * const loader = new PDFLoader({ splitByPage: true });
 * const pages = await loader.load('./paper.pdf');
 * ```
 */
export class PDFLoader extends BaseLoader {
  private readonly splitByPage: boolean;

  /**
   * @param options - 加载选项
   * @param options.splitByPage - 是否按页拆分，默认 true
   */
  constructor(options?: PDFLoaderOptions) {
    super();
    this.splitByPage = options?.splitByPage ?? true;
  }

  /**
   * 加载 PDF 文件
   *
   * @param source - 文件路径字符串或 Buffer
   * @returns 文档数组（splitByPage 为 true 时每页一个文档）
   */
  async load(source: string | Buffer): Promise<Document[]> {
    const buffer = Buffer.isBuffer(source)
      ? source
      : await readFile(resolve(source));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pdfParse: (data: Buffer) => Promise<any>;

    try {
      // 动态导入 pdf-parse，兼容 v1 和 v2
      const mod = await import('pdf-parse') as Record<string, unknown>;
      pdfParse = (mod['default'] ?? mod['PDFParse'] ?? mod) as typeof pdfParse;
    } catch {
      throw new Error(
        'PDFLoader 需要安装 pdf-parse 依赖：pnpm add pdf-parse'
      );
    }

    const pdfData = await pdfParse(buffer) as {
      text: string;
      numpages: number;
      info?: { Title?: string; Author?: string };
    };

    if (!this.splitByPage) {
      return [
        {
          id: this.generateId(),
          content: pdfData.text,
          metadata: {
            source: String(source),
            loader: 'PDFLoader',
            format: 'pdf',
            pageCount: pdfData.numpages,
            title: pdfData.info?.Title,
            author: pdfData.info?.Author,
          },
        },
      ];
    }

    // 按分页符拆分（pdf-parse 以 \f 作为分页标记）
    const pages = pdfData.text.split('\f').filter((p) => p.trim());

    return pages.map((pageText, index) => ({
      id: this.generateId(),
      content: pageText.trim(),
      metadata: {
        source: String(source),
        loader: 'PDFLoader',
        format: 'pdf',
        pageNumber: index + 1,
        totalPages: pdfData.numpages,
      },
    }));
  }
}
