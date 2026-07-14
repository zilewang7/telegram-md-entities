import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { renderMarkdown } from '../../src/index';
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
});
