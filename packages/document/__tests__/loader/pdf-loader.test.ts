import { describe, it, expect } from 'vitest';

describe('PDFLoader', () => {
  it('should export PDFLoader', async () => {
    const { PDFLoader } = await import('../../src/loader/pdf-loader');
    expect(PDFLoader).toBeDefined();
  });

  it('should create instance', async () => {
    const { PDFLoader } = await import('../../src/loader/pdf-loader');
    const loader = new PDFLoader();
    expect(loader).toBeDefined();
    expect(typeof loader.load).toBe('function');
  });

  it('should accept PDF parsing options', async () => {
    const { PDFLoader } = await import('../../src/loader/pdf-loader');
    const loader = new PDFLoader({
      extractMetadata: true,
      maxPages: 10,
    });
    expect(loader).toBeDefined();
  });

  it('should throw on invalid PDF Buffer', async () => {
    const { PDFLoader } = await import('../../src/loader/pdf-loader');
    const loader = new PDFLoader();
    // 传入无效的 PDF 数据应抛出错误
    await expect(loader.load(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});
