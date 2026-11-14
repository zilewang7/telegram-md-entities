import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, styleSegments, toRichMarkdown } from '../../src/index';
import type { RichMarkdownOptions, TextLinker } from '../../src/index';
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
/** Plus context references, what can sit around them, and code / anchors they must stay out of */
const LINK_PARTS = [
    '#1', '#12', ' #3 ', '\\#4', '&#35;5', '<a href="https://b.c">', '</a>', '$#6$', '`#7`',
    '<code>', '</code>', '!', ')', '.', '~', '=', '*', '#8~#9',
];
const linkSoup = soupOf([...MARKDOWN_PARTS, ...HTML_PARTS, ...LINK_PARTS]);

const LINK_BASE = 'https://t.me/c/42/';
const WORD_BASE = 'https://w.example/';

/** '#N' context references, as a bot links them: the run's neighbours count for the boundaries */
const hashLinker: TextLinker = (text, { before, after }) =>
    [...`${before}${text}${after}`.matchAll(/(?<![\w#])#(\d{1,3})(?![\w-])/g)]
        .map((match) => ({
            offset: (match.index ?? 0) - before.length,
            length: match[0].length,
            url: `${LINK_BASE}${match[1] ?? ''}`,
        }))
        .filter((link) => link.offset >= 0 && link.offset + link.length <= text.length);

/** Every word: ranges that start and end with letters, next to '_' and '*' far more often than '#N' */
const wordLinker: TextLinker = (text) =>
    [...text.matchAll(/[A-Za-z]{2,}|[\u4e00-\u9fff]{2,}/g)].map((match) => ({
        offset: match.index ?? 0,
        length: match[0].length,
        url: `${WORD_BASE}${encodeURIComponent(match[0])}`,
    }));

const isAddedLink = (url: string | undefined): boolean =>
    url !== undefined && (url.startsWith(LINK_BASE) || url.startsWith(WORD_BASE));

const ADDED_ANCHOR = /<a href="(?:https:\/\/t\.me\/c\/42\/|https:\/\/w\.example\/)[^"]*">([^<]*)<\/a>/g;

interface UnlinkedOutput {
    text: string;
    /** Where the label of a removed tag starts in text */
    labelStarts: ReadonlySet<number>;
}

/** The output with the <a> tags a test linker added taken out */
const withoutAddedAnchors = (markdown: string): UnlinkedOutput => {
    let text = '';
    const labelStarts = new Set<number>();
    let last = 0;
    for (const match of markdown.matchAll(ADDED_ANCHOR)) {
        const start = match.index ?? 0;
        text += markdown.slice(last, start);
        labelStarts.add(text.length);
        text += match[1] ?? '';
        last = start + match[0].length;
    }
    return { text: text + markdown.slice(last), labelStarts };
};

/**
 * The output without links, character for character, except that it may
 * have '\#' where a label starts with '#': a link at the start of a line
 * keeps that line from being a heading itself
 */
const sameButLinkedHashes = (plain: string, unlinked: UnlinkedOutput): boolean => {
    let plainIndex = 0;
    let index = 0;
    while (plainIndex < plain.length && index < unlinked.text.length) {
        const escapedHash =
            plain.startsWith('\\#', plainIndex) && unlinked.text[index] === '#' && unlinked.labelStarts.has(index);
        if (escapedHash) {
            plainIndex += 2;
            index += 1;
            continue;
        }
        if (plain[plainIndex] !== unlinked.text[index]) return false;
        plainIndex += 1;
        index += 1;
    }
    return plainIndex === plain.length && index === unlinked.text.length;
};

/**
 * Whether the label of an added link fits its url. Touching links with the
 * same url come back merged ('#1#1'), so a label may repeat its reference.
 */
const labelFitsUrl = (label: string, url: string): boolean => {
    if (url.startsWith(LINK_BASE)) {
        const references = label.match(/#\d{1,3}/g) ?? [];
        return references.join('') === label && references.every((reference) => `${LINK_BASE}${reference.slice(1)}` === url);
    }
    const word = decodeURIComponent(url.slice(WORD_BASE.length));
    return label.length > 0 && label.length % word.length === 0 && word.repeat(label.length / word.length) === label;
};

const OPTION_SETS: RichMarkdownOptions[] = [{}, { underline: false }, { spoilerMode: 'strict' }];

/** A status line the bot appends after a streaming frame */
const STATUS_LINE = '\n\n<p><i>STATUS</i></p>';
/** Every third prefix of every fixture: thorough enough, fast enough */
const PREFIX_STRIDE = 3;
const LINK_PREFIX_STRIDE = 7;

const INSERTED_TAG = /<\/?(?:b|i|u|s|tg-spoiler)>/g;
const DELIMITER_CHARS = new Set(['*', '_', '~', '|']);

/**
 * Undo the escapes the rewrite adds to text (a hard break for a soft one,
 * '\$' for a lone dollar, '\#' for a '#' starting a line), on both sides,
 * so the two compare as text
 */
const withoutTextEscapes = (markdown: string): string =>
    markdown.replace(/[ \t]*\\?\n/g, '\n').replace(/\\\$/g, '$').replace(/\\#/g, '#');

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

    it('without raw HTML, only delimiters and text escapes change: the rest of the input is kept in order', () => {
        fc.assert(
            fc.property(markdownSoup, (input) => {
                // Escapes first: a hard break's '\\' sits right before its newline, never before a tag
                const kept = withoutTextEscapes(toRichMarkdown(input)).replace(INSERTED_TAG, '');
                expect(removedOnlyDelimiters(withoutTextEscapes(input), kept), JSON.stringify(input)).toBe(true);
            }),
            { numRuns: 500 }
        );
    });

    /**
     * Links only add tags: taken out again, the output is the output without
     * links. Each tag reads as a link here (no markup of it shows as text,
     * e.g. inside code) whose label fits its url. The display referee does
     * not apply beyond that: this package's parser reads the tags as
     * punctuation next to a literal '**' or '~', Telegram does not (measured).
     */
    const linksOnlyAdd = (input: string, streaming: boolean, linker: TextLinker): boolean => {
        const plainSource = toRichMarkdown(input, { streaming });
        const linkedSource = toRichMarkdown(input, { streaming, textLinks: linker });
        if (!sameButLinkedHashes(plainSource, withoutAddedAnchors(linkedSource))) return false;
        const linked = renderMarkdown(linkedSource);
        if (/<a href="https:\/\/(?:t\.me\/c\/42|w\.example)\//.test(linked.text)) return false;
        return linked.entities.every(
            (entity) =>
                entity.type !== 'text_link' ||
                !isAddedLink(entity.url) ||
                labelFitsUrl(linked.text.slice(entity.offset, entity.offset + entity.length), entity.url ?? '')
        );
    };

    /** The rewrite without links reads like the input itself */
    const plainRewriteIsFaithful = (input: string, streaming: boolean): boolean =>
        JSON.stringify(styleSegments(renderMarkdown(toRichMarkdown(input, { streaming })))) ===
        JSON.stringify(styleSegments(renderMarkdown(input, { streaming })));

    // Every seventh prefix: each costs several renders per linker
    it('textLinks only add links: corpus documents and their streaming prefixes, #N and word linkers', { timeout: 60_000 }, () => {
        for (const { name, markdown } of loadCorpus()) {
            for (const linker of [hashLinker, wordLinker]) {
                expect(linksOnlyAdd(markdown, false, linker), `${name} strict`).toBe(true);
                for (let cut = 1; cut <= markdown.length; cut += LINK_PREFIX_STRIDE) {
                    const prefix = markdown.slice(0, cut);
                    if (!plainRewriteIsFaithful(prefix, true)) continue;
                    expect(linksOnlyAdd(prefix, true, linker), `${name} @${cut}`).toBe(true);
                }
            }
        }
    });

    it('textLinks only add links: soup with references around markup', { timeout: 60_000 }, () => {
        fc.assert(
            fc.property(linkSoup, fc.boolean(), fc.constantFrom(hashLinker, wordLinker), (input, streaming, linker) => {
                fc.pre(plainRewriteIsFaithful(input, streaming));
                expect(linksOnlyAdd(input, streaming, linker), JSON.stringify(input)).toBe(true);
            }),
            { numRuns: 1500 }
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
