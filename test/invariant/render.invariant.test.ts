import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, validateMessage, wrapInBlockquote } from '../../src/index';
import type { RenderedMessage, ValidationIssue } from '../../src/types';
import { loadCorpus } from '../helpers/corpus';
import { expectWellFormed } from '../helpers/assertions';

/** Random markdown-ish soup: fragments LLMs actually emit, recombined */
const markdownSoup = fc
    .array(
        fc.constantFrom(
            '**', '*', '_', '~~', '||', '`', '```\n', '```python\n',
            '\n', '\n\n', '> ', '- ', '1. ', '# ', '---\n',
            '[', ']', '(', ')', '<', '>',
            'https://a.b/c?x=1', 'www.example.com',
            '文字内容', 'plain text ', '🎸😂', '句号。', '逗号,',
            '| a | b |\n', '| --- | --- |\n', '\\*', '\\\\'
        ),
        { maxLength: 50 }
    )
    .map((parts) => parts.join(''));

describe('renderMarkdown invariants', () => {
    it('corpus renders are well-formed', () => {
        for (const { markdown } of loadCorpus()) {
            expectWellFormed(renderMarkdown(markdown));
        }
    });

    it('never throws and stays well-formed on arbitrary strings', () => {
        fc.assert(
            fc.property(fc.string({ maxLength: 500 }), (input) => {
                expectWellFormed(renderMarkdown(input));
            }),
            { numRuns: 300 }
        );
    });

    it('never throws and stays well-formed on markdown soup', () => {
        fc.assert(
            fc.property(markdownSoup, (input) => {
                expectWellFormed(renderMarkdown(input));
            }),
            { numRuns: 500 }
        );
    });

    it('no render nests a block entity inside a quote', () => {
        const blockInsideQuote = (input: RenderedMessage): ValidationIssue[] =>
            validateMessage(input).filter((issue) => issue.code === 'block-in-quote');

        for (const { name, markdown } of loadCorpus()) {
            const message = renderMarkdown(markdown);
            expect(blockInsideQuote(message), name).toEqual([]);
            // Wrapping in a quote must not reintroduce one either
            expect(blockInsideQuote(wrapInBlockquote(message, true)), name).toEqual([]);
        }

        fc.assert(
            fc.property(markdownSoup, (input) => {
                expect(blockInsideQuote(renderMarkdown(input))).toEqual([]);
            }),
            { numRuns: 500 }
        );
    });
});
