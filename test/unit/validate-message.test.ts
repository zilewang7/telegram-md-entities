import { describe, expect, it } from 'vitest';
import { validateMessage } from '../../src/validate/validate-message';
import type { MessageEntity, RenderedMessage } from '../../src/types';

const message = (text: string, entities: MessageEntity[]): RenderedMessage => ({
    text,
    entities,
});

const codes = (input: RenderedMessage): string[] =>
    validateMessage(input).map((issue) => issue.code);

describe('validateMessage', () => {
    it('accepts a clean message', () => {
        expect(
            codes(
                message('hello world', [
                    { type: 'bold', offset: 0, length: 5 },
                    { type: 'italic', offset: 2, length: 2 },
                ])
            )
        ).toEqual([]);
    });

    it('flags out-of-bounds and zero-length', () => {
        expect(codes(message('abc', [{ type: 'bold', offset: 1, length: 5 }]))).toContain(
            'length-out-of-bounds'
        );
        expect(codes(message('abc', [{ type: 'bold', offset: 0, length: 0 }]))).toContain(
            'zero-length'
        );
    });

    it('flags surrogate-splitting boundaries', () => {
        expect(codes(message('a😂b', [{ type: 'bold', offset: 0, length: 2 }]))).toContain(
            'surrogate-misaligned'
        );
    });

    it('flags partial overlap', () => {
        expect(
            codes(
                message('abcdefgh', [
                    { type: 'bold', offset: 0, length: 5 },
                    { type: 'italic', offset: 3, length: 4 },
                ])
            )
        ).toContain('overlap-not-nested');
    });

    it('flags entities inside pre/code and nested quotes', () => {
        expect(
            codes(
                message('const x = 1', [
                    { type: 'pre', offset: 0, length: 11 },
                    { type: 'bold', offset: 0, length: 5 },
                ])
            )
        ).toContain('illegal-nesting');
        expect(
            codes(
                message('quoted text here', [
                    { type: 'blockquote', offset: 0, length: 16 },
                    { type: 'expandable_blockquote', offset: 2, length: 4 },
                ])
            )
        ).toContain('illegal-nesting');
    });

    it('flags text_link without url and stray fields', () => {
        expect(codes(message('abc', [{ type: 'text_link', offset: 0, length: 3 }]))).toContain(
            'missing-url'
        );
        expect(
            codes(message('abc', [{ type: 'bold', offset: 0, length: 3, url: 'https://x' }]))
        ).toContain('unexpected-field');
    });
});
