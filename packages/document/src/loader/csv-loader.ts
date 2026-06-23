import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BaseLoader } from './base';
import type { Document, CSVLoaderOptions } from '../types';

/**
 * CSV 加载器
 *
 * 加载 CSV 文件，每行生成一个 Document。
 * 适用于表格型数据（如产品目录、FAQ 列表）。
 */
export class CSVLoader extends BaseLoader {
  private readonly delimiter: string;
  private readonly contentColumns: string[];
  private readonly headerRow: boolean;

  /**
   * @param options - 加载选项
   * @param options.delimiter - 字段分隔符，默认 ','
   * @param options.contentColumns - 作为内容的列名，空则合并所有列
   * @param options.headerRow - 首行是否为表头，默认 true
   */
  constructor(options?: CSVLoaderOptions) {
    super();
    this.delimiter = options?.delimiter ?? ',';
    this.contentColumns = options?.contentColumns ?? [];
    this.headerRow = options?.headerRow ?? true;
  }

  /**
   * 加载 CSV 文件
   *
   * @param source - 文件路径字符串或 Buffer
   * @returns 文档数组（每行一个 Document）
   */
  async load(source: string | Buffer): Promise<Document[]> {
    const content = Buffer.isBuffer(source)
      ? source.toString('utf-8')
      : await readFile(resolve(source), 'utf-8');

    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return [];

    const headers = this.headerRow
      ? this.parseLine(lines[0]!)
      : this.parseLine(lines[0]!).map((_, i) => `col_${i}`);

    const dataLines = this.headerRow ? lines.slice(1) : lines;

    return dataLines.map((line, index) => {
      const values = this.parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i] ?? '';
      });

      // 拼接内容
      const docContent = this.contentColumns.length > 0
        ? this.contentColumns.map((col) => row[col] ?? '').join('\n')
        : Object.values(row).join('\n');

      return {
        id: this.generateId(),
        content: docContent.trim(),
        metadata: {
          source: String(source),
          loader: 'CSVLoader',
          format: 'csv',
          rowIndex: index,
          ...row,
        },
      };
    });
  }

  /**
   * 解析 CSV 单行
   *
   * 简单 CSV 解析，处理引号包裹的字段。
   *
   * @param line - CSV 行文本
   * @returns 字段值数组
   */
  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // 转义引号
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === this.delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }
}
