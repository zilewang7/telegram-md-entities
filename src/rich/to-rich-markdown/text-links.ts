/**
 * Links the caller adds to literal text ('#12' → the message it refers to).
 * The caller finds the ranges in the text a reader sees; this file puts
 * them back at their source offsets and wraps each in an <a> tag. A tag,
 * not '[…](…)': inside a <details> element Telegram reads HTML, and the
 * other rewrites (emphasis to <b>, <i>…) are tags for the same reason.
 *
 * Anything uncertain is skipped, never guessed: a range whose source is not
 * exactly its text (an escape, a character reference), a range with
 * characters that could pair with markup around it, a url that would need
 * escaping inside an attribute, a range inside a '$…$' formula.
 *
 * What is next to a range stays as written. This package's parser reads the
 * inserted tags as punctuation, so a literal '**' or '~' right beside one
 * can pair differently here; Telegram pairs such runs the same with or
 * without the tags (measured: '#1**"引用"**', '#12~#15 … 3~5',
 * '#1~~#2~~', '==重点 #1==' show alike either way), while escaping them
 * breaks its reading of the line.
 */
import type { Text } from 'mdast';
import type { SourceSpan } from './dollar-runs';
import type { SourceEdit } from './source-edits';
import { textValueToSource } from './text-value-map';

/** One range of a text run to link, in UTF-16 code units of that run */
export interface TextLink {
    offset: number;
    length: number;
    url: string;
}

/** What a reader sees right around a run: one character each side, '' at the edge of its block */
export interface TextLinkContext {
    before: string;
    after: string;
}

/** Called with the text of one run of literal text; returns the ranges to link */
export type TextLinker = (text: string, context: TextLinkContext) => readonly TextLink[];

/** Characters that markdown or HTML could pair with something outside the range */
const MARKUP_CHARS = /[\\`*_~|=$[\]<>&\n\r]/;

/**
 * An http(s) URL with a host, or a tg URL, that an attribute can hold as
 * written: no whitespace or control characters, quotes, angle brackets,
 * '&' (it would need '&amp;'), backslash or backtick, no '|' (a table cell
 * would end there) and no '$' (Telegram's math scan is not HTML-aware).
 */
const ATTRIBUTE_SAFE_URL =
    /^(?:https?:\/\/[^\s\p{C}/?#"'<>\\`&|$]+(?:[/?#][^\s\p{C}"'<>\\`&|$]*)?|tg:\/\/[^\s\p{C}"'<>\\`&|$]+)$/iu;

const isHighSurrogate = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff;
const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

const splitsSurrogatePair = (text: string, index: number): boolean =>
    index > 0 && index < text.length && isHighSurrogate(text.charCodeAt(index - 1)) && isLowSurrogate(text.charCodeAt(index));

/** A returned range read once into plain values: a getter cannot run twice or throw later */
const plainLinkOf = (link: unknown): TextLink | null => {
    if (typeof link !== 'object' || link === null) return null;
    if (!('offset' in link) || !('length' in link) || !('url' in link)) return null;
    const { offset, length, url } = link;
    return typeof offset === 'number' && typeof length === 'number' && typeof url === 'string'
        ? { offset, length, url }
        : null;
};

/** The caller's ranges for one run; a linker that throws or returns no array links nothing there */
const linksOf = (linker: TextLinker, text: string, context: TextLinkContext): TextLink[] => {
    try {
        const returned: unknown = linker(text, context);
        if (!Array.isArray(returned)) return [];
        const items: unknown[] = returned;
        return items.map(plainLinkOf).filter((link): link is TextLink => link !== null);
    } catch {
        return [];
    }
};

/** Whole, in-bounds ranges that do not cut a character in half */
const isValidRange = (link: TextLink, text: string): boolean =>
    Number.isInteger(link.offset) &&
    Number.isInteger(link.length) &&
    link.offset >= 0 &&
    link.length > 0 &&
    link.offset + link.length <= text.length &&
    !splitsSurrogatePair(text, link.offset) &&
    !splitsSurrogatePair(text, link.offset + link.length);

/** In order of their start (ties in the caller's order); one overlapping a range taken before is dropped */
const withoutOverlaps = (links: readonly TextLink[]): TextLink[] => {
    const taken: TextLink[] = [];
    let takenEnd = 0;
    for (const link of [...links].sort((left, right) => left.offset - right.offset)) {
        if (taken.length > 0 && link.offset < takenEnd) continue;
        taken.push(link);
        takenEnd = link.offset + link.length;
    }
    return taken;
};

export interface TextLinkInput {
    source: string;
    node: Text;
    linker: TextLinker;
    context: TextLinkContext;
    /** The '$…$' pairs kept in this node: their content is math to Telegram */
    formulas: readonly SourceSpan[];
}

/** The <a> tags for the caller's ranges of one text node */
export const textLinkEdits = (input: TextLinkInput): SourceEdit[] => {
    const { source, node, formulas } = input;
    const links = withoutOverlaps(
        linksOf(input.linker, node.value, input.context).filter((link) => isValidRange(link, node.value))
    );
    if (links.length === 0) return [];
    const map = textValueToSource(source, node);
    if (map === null) return [];

    const edits: SourceEdit[] = [];
    for (const link of links) {
        if (!ATTRIBUTE_SAFE_URL.test(link.url)) continue;
        const text = node.value.slice(link.offset, link.offset + link.length);
        if (MARKUP_CHARS.test(text)) continue;
        const start = map(link.offset);
        const last = map(link.offset + link.length - 1);
        if (start === undefined || last === undefined) continue;
        const end = last + 1;
        // Same characters in the source, and not the target of an escape
        if (source.slice(start, end) !== text || source[start - 1] === '\\') continue;
        if (formulas.some((formula) => start < formula.end && end > formula.start)) continue;
        edits.push({ start, end, text: `<a href="${link.url}">${text}</a>` });
    }
    return edits;
};
