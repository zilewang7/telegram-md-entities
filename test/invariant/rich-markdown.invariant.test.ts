import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, styleSegments, toRichMarkdown } from '../../src/index';
import type { RichMarkdownOptions } from '../../src/index';
import { expectWellFormed } from '../helpers/assertions';
import { loadCorpus } from '../helpers/corpus';

/** Fragments LLMs emit, recombined */
const MARKDOWN_PARTS = [
    '**', '*', '_', '__', '~~', '~', '||', '`', '```\n', '\n', '\n\n', '> ', '- ', '1. ', '# ',
    '[', ']', '(', ')', 'https://a.b/c?x=1', '文字', 'text ', '的', '"',
    '| a | b |\n', '| --- | --- |\n', '\\*', '&amp;', '$', '==', '    ',
];
/** Plus the HTML the rewrite has to handle */
const HTML_PARTS = [
    '<', '>', '<b>', '</b>', '<i>', '</span>', '<span class="tg-spoiler">', '<details>', '</details>',
    '<summary>', '</summary>', '<br>', '<div>', '</div>', '<!-- c -->', '<pre>', '</pre>',
    'List<String>', '<ul>', '<li>',
];
const soupOf = (parts: string[]) =>
    fc.array(fc.constantFrom(...parts), { maxLength: 40 }).map((picked) => picked.join(''));
const markdownSoup = soupOf(MARKDOWN_PARTS);
const markdownHtmlSoup = soupOf([...MARKDOWN_PARTS, ...HTML_PARTS]);

const OPTION_SETS: RichMarkdownOptions[] = [{}, { underline: false }, { spoilerMode: 'strict' }];

/** A status line the bot appends after a streaming frame */
const STATUS_LINE = '\n\n<p><i>STATUS</i></p>';
/** Every third prefix of every fixture: thorough enough, fast enough */
const PREFIX_STRIDE = 3;

const INSERTED_TAG = /<\/?(?:b|i|u|s|tg-spoiler)>/g;
const DELIMITER_CHARS = new Set(['*', '_', '~', '|']);

/** `kept` is `input` with some delimiter characters taken out, nothing else */
const removedOnlyDelimiters = (input: string, kept: string): boolean => {
    let keptIndex = 0;
    for (let inputIndex = 0; inputIndex < input.length; inputIndex += 1) {
        const char = input[inputIndex] ?? '';
        if (kept[keptIndex] === char) keptIndex += 1;
        else if (!DELIMITER_CHARS.has(char)) return false;
    }
    return keptIndex === kept.length;
};

describe('toRichMarkdown invariants', () => {
    it('corpus: renderMarkdown shows the same text and styles before and after', () => {
        for (const { name, markdown } of loadCorpus()) {
            for (const options of OPTION_SETS) {
                const rich = toRichMarkdown(markdown, options);
                expect(styleSegments(renderMarkdown(rich, options)), `${name} ${JSON.stringify(options)}`).toEqual(
                    styleSegments(renderMarkdown(markdown, options))
                );
            }
        }
    });

    it('corpus: streaming a complete document gives the strict output', () => {
        for (const { name, markdown } of loadCorpus()) {
            expect(toRichMarkdown(markdown, { streaming: true }), name).toBe(toRichMarkdown(markdown));
        }
    });

    it('corpus prefixes: a status line appended to a streaming frame is outside every construct', () => {
        for (const { name, markdown } of loadCorpus()) {
            for (let cut = 1; cut <= markdown.length; cut += PREFIX_STRIDE) {
                const frame = toRichMarkdown(markdown.slice(0, cut), { streaming: true });
                const rendered = renderMarkdown(frame + STATUS_LINE);
                // The package shows the unknown <p> literally and the <i> as italic
                expect(rendered.text.endsWith('<p>STATUS</p>'), `${name} @${cut}`).toBe(true);
                const statusAt = rendered.text.length - 'STATUS</p>'.length;
                const covering = rendered.entities
                    .filter((entity) => entity.offset <= statusAt && entity.offset + entity.length > statusAt)
                    .map((entity) => entity.type);
                expect(covering, `${name} @${cut}`).toEqual(['italic']);
            }
        }
    });

    // Weaker than display equivalence on purpose: on delimiter soup the
    // pairing can shift once some pairs are tags, and renderMarkdown itself
    // has known invalid outputs for soup (an inline <pre> around a code span)
    it('never throws on arbitrary strings and soup', () => {
        fc.assert(
            fc.property(fc.oneof(fc.string({ maxLength: 300 }), markdownHtmlSoup), fc.boolean(), (input, streaming) => {
                expect(typeof toRichMarkdown(input, { streaming })).toBe('string');
            }),
            { numRuns: 600 }
        );
    });

    it('without raw HTML, only delimiters change: tags out, the rest of the input is kept in order', () => {
        fc.assert(
            fc.property(markdownSoup, (input) => {
                const kept = toRichMarkdown(input).replace(INSERTED_TAG, '');
                expect(removedOnlyDelimiters(input, kept), JSON.stringify(input)).toBe(true);
            }),
            { numRuns: 500 }
        );
    });

    it('corpus renders stay well-formed', () => {
        for (const { name, markdown } of loadCorpus()) {
            for (const streaming of [false, true]) {
                const rendered = renderMarkdown(toRichMarkdown(markdown, { streaming }));
                expect(rendered.text, name).toBe(rendered.text.trim());
                expectWellFormed(rendered);
            }
        }
    });
});
