import { describe, it, expect } from 'vitest';
import { RAGPipeline } from '../src/pipeline';

describe('RAGPipeline', () => {
  it('should throw if llm is missing', () => {
    expect(() => new RAGPipeline({ embedding: null, store: null, chunker: null } as any)).toThrow();
  });

  it('should throw if embedding is missing', () => {
    expect(() => new RAGPipeline({ llm: null, store: null, chunker: null } as any)).toThrow();
  });

  it('should throw if store is missing', () => {
    expect(() => new RAGPipeline({ llm: null, embedding: null, chunker: null } as any)).toThrow();
  });

  it('should throw if chunker is missing', () => {
    expect(() => new RAGPipeline({ llm: null, embedding: null, store: null } as any)).toThrow();
  });
});
