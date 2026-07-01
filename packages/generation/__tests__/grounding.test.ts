import { describe, it, expect, vi } from 'vitest';
import { GroundedGenerator } from '../src/grounding';
import type { LLMProvider, Chunk } from '@ragsdk/core';
import type { GroundingVerification } from '../src/types';

const makeChunk = (id: string, content: string): Chunk => ({
  id,
  documentId: 'doc-1',
  content,
  metadata: {},
});

describe('GroundedGenerator', () => {
  it('should generate and verify grounding', async () => {
    const verification: GroundingVerification = {
      isGrounded: true,
      unsupportedClaims: [],
      groundingScore: 0.95,
    };

    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('TypeScript is a language.'),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockResolvedValue(verification),
    };

    const generator = new GroundedGenerator(llm);
    const result = await generator.generate('What is TypeScript?', [
      makeChunk('c1', 'TypeScript is a programming language.'),
    ]);

    expect(result.answer).toBe('TypeScript is a language.');
    expect(result.verification.isGrounded).toBe(true);
    expect(result.verification.groundingScore).toBe(0.95);
  });

  it('should detect hallucination', async () => {
    const verification: GroundingVerification = {
      isGrounded: false,
      unsupportedClaims: ['TypeScript was created in 2012'],
      groundingScore: 0.3,
    };

    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('TypeScript was created in 2012 by Microsoft.'),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockResolvedValue(verification),
    };

    const generator = new GroundedGenerator(llm);
    const result = await generator.generate('When was TypeScript created?', [
      makeChunk('c1', 'TypeScript is a programming language.'),
    ]);

    expect(result.verification.isGrounded).toBe(false);
    expect(result.verification.unsupportedClaims).toContain('TypeScript was created in 2012');
  });

  it('should handle empty chunks', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('no info'),
      chatStream: vi.fn(),
      chatJson: vi.fn(),
    };

    const generator = new GroundedGenerator(llm);
    const result = await generator.generate('test', []);

    expect(result.answer).toContain('无法找到');
  });

  it('should fallback when chatJson fails', async () => {
    const llm: LLMProvider = {
      chat: vi.fn().mockResolvedValue('answer'),
      chatStream: vi.fn(),
      chatJson: vi.fn().mockRejectedValue(new Error('not supported')),
    };

    const generator = new GroundedGenerator(llm);
    const result = await generator.generate('test', [makeChunk('c1', 'context')]);

    expect(result.answer).toBe('answer');
    expect(result.verification).toBeDefined();
  });
});
