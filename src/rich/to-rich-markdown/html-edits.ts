/**
 * Rewrite raw HTML (an mdast html node's value) so Telegram's rich parser
 * reads it the way this package renders it:
 *   - tags the package understands stay as written;
 *   - <span class="tg-spoiler">…</span> becomes <tg-spoiler>…</tg-spoiler>
 *     (Telegram drops the span form), paired per leaf block like the
 *     renderer's tag stack;
 *   - anything the package shows as literal text (unknown tags, comments,
 *     a span close with nothing to close) is escaped so Telegram shows it
 *     literally too, instead of dropping it or swallowing what follows.
 */
import { isKnownCloseTag, readOpenTag, tokenizeHtml, type HtmlToken } from '../../render/html-tags';
import { literalEscapeEdits, type SoftBreakTest } from './literal-escape';
import type { SourceEdit } from './source-edits';

/** Open spoiler spans of the current leaf block (the renderer's pairing scope) */
export interface SpoilerSpanState {
    open: number;
}

/**
 * Where the html sits, which decides how a literal piece is escaped:
 * - 'inline': an inline html node in a paragraph; an escaped piece becomes
 *   paragraph text, so it gets the full literal escape;
 * - 'block': an html block that stays one (its first tag is kept); the
 *   content is HTML to Telegram, so only the '<' of a literal piece is
 *   escaped, as an HTML entity.
 * An html block whose first tag is escaped stops being a block and turns
 * into a paragraph: it is then rewritten like 'inline' throughout.
 */
type HtmlContext = 'inline' | 'block';

type TagRewrite = { kind: 'keep' } | { kind: 'replace'; text: string } | { kind: 'literal' };

type TagToken = Extract<HtmlToken, { kind: 'tag' }>;

interface PlacedToken {
    token: HtmlToken;
    start: number;
    end: number;
}

const placeTokens = (value: string): PlacedToken[] => {
    let offset = 0;
    return tokenizeHtml(value).map((token) => {
        const length = token.kind === 'text' ? token.value.length : token.raw.length;
        const placed = { token, start: offset, end: offset + length };
        offset += length;
        return placed;
    });
};

const KEEP: TagRewrite = { kind: 'keep' };
const LITERAL: TagRewrite = { kind: 'literal' };

const rewriteTag = (token: TagToken, spans: SpoilerSpanState): TagRewrite => {
    if (token.closing) {
        if (token.name === 'span') {
            if (spans.open === 0) return LITERAL;
            spans.open -= 1;
            return { kind: 'replace', text: '</tg-spoiler>' };
        }
        return isKnownCloseTag(token.name) ? KEEP : LITERAL;
    }
    const reading = readOpenTag(token.name, token.attrs);
    if (reading === 'literal') return LITERAL;
    // A self-closing spoiler span wraps nothing (the renderer ignores it)
    if (reading === 'spoiler-span' && !token.selfClosing) {
        spans.open += 1;
        return { kind: 'replace', text: '<tg-spoiler>' };
    }
    return KEEP;
};

/** Text an HTML parser would read as markup: '<' before a letter, '/', '!' or '?' */
const markupLikeLessThan = (value: string, start: number, end: number): SourceEdit[] => {
    const edits: SourceEdit[] = [];
    for (let index = start; index < end; index += 1) {
        if (value[index] === '<' && /[A-Za-z/!?]/.test(value[index + 1] ?? '')) {
            edits.push({ start: index, end: index + 1, text: '&lt;' });
        }
    }
    return edits;
};

const literalEdits = (
    value: string,
    placed: PlacedToken,
    context: HtmlContext,
    staysSoft: SoftBreakTest
): SourceEdit[] =>
    context === 'inline'
        ? literalEscapeEdits(value, placed.start, placed.end, staysSoft)
        : markupLikeLessThan(value, placed.start, placed.end);

interface TokenDecision {
    placed: PlacedToken;
    rewrite: TagRewrite | null;
}

const isBlank = (placed: PlacedToken): boolean =>
    placed.token.kind === 'text' && placed.token.value.trim() === '';

/** An html block stays one only when its leading tag survives the rewrite */
const staysHtmlBlock = (decisions: readonly TokenDecision[]): boolean => {
    const leading = decisions.find((decision) => !isBlank(decision.placed));
    return leading !== undefined && leading.rewrite !== null && leading.rewrite.kind !== 'literal';
};

/** Kept tags that can start an html block, and so end a paragraph, at a line start */
const BLOCK_OPENING_TAGS = new Set(['pre', 'ul', 'ol', 'li', 'details', 'summary']);

const isLineStartAt = (value: string, index: number): boolean =>
    value.slice(value.lastIndexOf('\n', index - 1) + 1, index).trim() === '';

/** Offsets of the lines that a kept block-opening tag starts */
const blockLineStarts = (value: string, decisions: readonly TokenDecision[]): number[] =>
    decisions.flatMap(({ placed, rewrite }) => {
        const opens =
            placed.token.kind === 'tag' &&
            rewrite !== null &&
            rewrite.kind !== 'literal' &&
            BLOCK_OPENING_TAGS.has(placed.token.name) &&
            isLineStartAt(value, placed.start);
        return opens ? [placed.start] : [];
    });

/**
 * Once escaped, a block's lines read as paragraph text, except from a line
 * that a kept block tag starts up to the next blank line: that part is an
 * html block again, where a '\' would show.
 */
const softBreakTest = (value: string, decisions: readonly TokenDecision[]): SoftBreakTest => {
    const blockStarts = blockLineStarts(value, decisions);
    return (newlineIndex) => {
        const nextLineEnd = value.indexOf('\n', newlineIndex + 1);
        const paragraphStart = value.lastIndexOf('\n\n', newlineIndex);
        return blockStarts.some(
            (start) => start > paragraphStart && start <= (nextLineEnd === -1 ? value.length : nextLineEnd)
        );
    };
};

export interface HtmlRewrite {
    /** Edits relative to the value */
    edits: SourceEdit[];
    /** An html block whose leading tag was escaped: it now reads as paragraph text */
    becameText: boolean;
}

/**
 * Edits for one html node. `spans` carries the spoiler span pairing across
 * the inline html nodes of one leaf block.
 */
export const htmlValueEdits = (
    value: string,
    isBlock: boolean,
    spans: SpoilerSpanState
): HtmlRewrite => {
    const decisions: TokenDecision[] = placeTokens(value).map((placed) => ({
        placed,
        rewrite: placed.token.kind === 'tag' ? rewriteTag(placed.token, spans) : null,
    }));
    const context: HtmlContext = isBlock && staysHtmlBlock(decisions) ? 'block' : 'inline';
    const staysSoft = softBreakTest(value, decisions);

    const edits = decisions.flatMap(({ placed, rewrite }): SourceEdit[] => {
        // Text: inside a kept block it is HTML text; elsewhere it is a
        // comment / declaration the package shows literally
        if (rewrite === null) return literalEdits(value, placed, context, staysSoft);
        if (rewrite.kind === 'keep') return [];
        if (rewrite.kind === 'replace') {
            return [{ start: placed.start, end: placed.end, text: rewrite.text }];
        }
        return literalEdits(value, placed, context, staysSoft);
    });
    return { edits, becameText: isBlock && context === 'inline' };
};
