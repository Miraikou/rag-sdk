import { describe, it, expect } from 'vitest';
import { BasePromptTemplate } from '../src/prompt-template';
import type { Chunk } from '@rag-sdk/core';

const makeChunk = (id: string, content: string): Chunk => ({
  id,
  documentId: 'doc-1',
  content,
  metadata: {},
});

describe('BasePromptTemplate', () => {
  it('should format query and context into messages', () => {
    const template = BasePromptTemplate.default();
    const chunks = [makeChunk('c1', 'TypeScript is a language'), makeChunk('c2', 'Python is popular')];

    const messages = template.format('What is TypeScript?', chunks);

    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.role).toBe('user');
    expect(messages[1]!.content).toContain('What is TypeScript?');
    expect(messages[1]!.content).toContain('TypeScript is a language');
    expect(messages[1]!.content).toContain('[1]');
    expect(messages[1]!.content).toContain('[2]');
  });

  it('should replace {sourceCount} variable', () => {
    const template = BasePromptTemplate.default();
    const chunks = [makeChunk('c1', 'text1'), makeChunk('c2', 'text2'), makeChunk('c3', 'text3')];

    const messages = template.format('test', chunks);

    expect(messages[1]!.content).toContain('3');
  });

  it('should truncate context when maxContextLength is set', () => {
    const template = BasePromptTemplate.default();
    const chunks = [makeChunk('c1', 'A'.repeat(1000))];

    const messages = template.format('test', chunks, { maxContextLength: 100 });

    expect(messages[1]!.content.length).toBeLessThan(200);
  });

  it('should create strict template', () => {
    const template = BasePromptTemplate.strict();
    const messages = template.format('test', [makeChunk('c1', 'content')]);

    expect(messages[0]!.content).toContain('严格');
  });

  it('should create citation template', () => {
    const template = BasePromptTemplate.citation();
    const messages = template.format('test', [makeChunk('c1', 'content')]);

    expect(messages[0]!.content).toContain('[1]');
    expect(messages[1]!.content).toContain('[1]');
  });

  it('should handle empty chunks', () => {
    const template = BasePromptTemplate.default();
    const messages = template.format('test', []);

    expect(messages).toHaveLength(2);
    expect(messages[1]!.content).toContain('0');
  });
});
