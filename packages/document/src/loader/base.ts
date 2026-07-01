import { randomUUID } from 'crypto';
import type { Document, DocumentLoader } from '@ragsdk/core';

/**
 * 文档加载器抽象基类
 *
 * 所有加载器继承此类，共享 ID 生成等通用逻辑。
 */
export abstract class BaseLoader implements DocumentLoader {
  /**
   * 加载文档
   *
   * @param source - 文件路径或 Buffer
   * @returns 解析后的文档数组
   */
  abstract load(source: string | Buffer): Promise<Document[]>;

  /**
   * 生成唯一文档 ID
   *
   * @returns UUID v4 格式的随机字符串
   */
  protected generateId(): string {
    return randomUUID();
  }
}
