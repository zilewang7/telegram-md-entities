/**
 * An html block whose leading tag is escaped reads as paragraph text to
 * Telegram, so it runs into the text beside it where this package shows two
 * blocks:
 * - a paragraph line right above it (an html block may interrupt a
 *   paragraph: '文字\n<p>…</p>') continues into it. A hard break at the end
 *   of the paragraph keeps the escaped block on its own line;
 * - a line right below it (after a block that ends at its own last line: a
 *   comment, '<?…?>', '<!X…>') continues it: a paragraph line, an indented
 *   line, a list that starts at 2, and '===' or '---' underline it into a
 *   heading (measured). A hard break is enough before a paragraph of the
 *   same container; anything else that cannot interrupt a paragraph gets a
 *   blank line.
 * Across a container's end a hard break is not enough: the line below a
 * quote or a list item would still continue its paragraph (a lazy
 * continuation line), so a blank line ends the container first. A table
 * right above takes the escaped block in as a row (GFM): a blank line ends
 * the table as well.
 */
import type { Html, RootContent } from 'mdast';
import { match } from 'ts-pattern';
import type { SourceEdit } from './source-edits';

/** Only the line end (and the next line's container prefix) between the two */
const ADJACENT_LINES = /^([ \t]*)\n([ \t>]*)$/;

/** The block after another one in reading order */
export interface FollowingBlock {
    node: RootContent;
    /** In the same container; false when it follows the container's end */
    isSibling: boolean;
}

/** '===' or '--' alone on the first line: an underline after a paragraph line */
const startsWithUnderline = (start: number, source: string): boolean => /^(?:=+|-+)[ \t]*(?:\n|$)/.test(source.slice(start));

const isFencedCode = (start: number, source: string): boolean => /^[ \t]*(?:```|~~~)/.test(source.slice(start));

const firstLineOf = (start: number, source: string): string => {
    const lineEnd = source.indexOf('\n', start);
    return source.slice(start, lineEnd === -1 ? source.length : lineEnd);
};

/** A list whose first item starts empty ('-' alone on its line) cannot interrupt a paragraph */
const startsEmpty = (start: number, source: string): boolean =>
    /^(?:[-+*]|\d{1,9}[.)])[ \t]*$/.test(firstLineOf(start, source));

/**
 * Tags the package keeps that open an html block which may interrupt a
 * paragraph (CommonMark types 1 and 6); any other html block reads as text
 * once escaped, or does not interrupt
 */
const INTERRUPTING_TAG = /^[ \t]*<\/?(?:pre|details|summary|ul|ol|li)(?:[\s/>]|$)/i;

/** Whether a block's first line ends a paragraph right above it by itself */
const interruptsParagraph = (node: RootContent, start: number, end: number, source: string): boolean =>
    match(node)
        .with({ type: 'blockquote' }, { type: 'listItem' }, () => true)
        // Only a bullet or '1.' with content may start a list right after a paragraph line
        .with({ type: 'list' }, (list) => (!list.ordered || list.start === 1) && !startsEmpty(start, source))
        // A setext heading's first line would continue the paragraph
        .with({ type: 'heading' }, () => !source.slice(start, end).includes('\n'))
        .with({ type: 'code' }, () => isFencedCode(start, source))
        // '---' would underline the paragraph instead
        .with({ type: 'thematicBreak' }, () => source[start] !== '-')
        // A '$$' formula that starts a line is a block to Telegram (display-math.ts)
        .with({ type: 'paragraph' }, () => source.startsWith('$$', start))
        .with({ type: 'html' }, (html) => INTERRUPTING_TAG.test(html.value))
        .otherwise(() => false);

/** The last block of a container in reading order; a block that is no container itself */
const lastBlockOf = (node: RootContent): RootContent =>
    match(node)
        .with({ type: 'blockquote' }, { type: 'list' }, { type: 'listItem' }, { type: 'footnoteDefinition' }, (container) => {
            const last: RootContent | undefined = container.children[container.children.length - 1];
            return last === undefined ? container : lastBlockOf(last);
        })
        .otherwise(() => node);

const hardBreak = (lineEnd: number, trailingSpaces: number): SourceEdit => ({
    start: lineEnd,
    end: lineEnd + trailingSpaces + 1,
    text: '\\\n',
});

/** A blank line that keeps the container prefix of the line after it ('>' is all a quote needs) */
const blankLine = (lineEnd: number, trailingSpaces: number, nextPrefix: string): SourceEdit => ({
    start: lineEnd,
    end: lineEnd + trailingSpaces + 1,
    text: `\n${nextPrefix.trimEnd()}\n`,
});

/** What keeps an escaped html block apart from the block right below it */
export const breakAfterTextBlock = (html: Html, following: FollowingBlock | undefined, source: string): SourceEdit[] => {
    if (following === undefined) return [];
    const htmlEnd = html.position?.end.offset;
    const nextStart = following.node.position?.start.offset;
    const nextEnd = following.node.position?.end.offset;
    if (htmlEnd === undefined || nextStart === undefined || nextEnd === undefined) return [];
    const adjacent = ADJACENT_LINES.exec(source.slice(htmlEnd, nextStart));
    if (!adjacent || interruptsParagraph(following.node, nextStart, nextEnd, source)) return [];
    const trailingSpaces = adjacent[1]?.length ?? 0;
    const hardBreakIsEnough =
        following.isSibling && following.node.type === 'paragraph' && !startsWithUnderline(nextStart, source);
    return [hardBreakIsEnough ? hardBreak(htmlEnd, trailingSpaces) : blankLine(htmlEnd, trailingSpaces, adjacent[2] ?? '')];
};

/**
 * What keeps an escaped html block apart from the paragraph right above it,
 * or from a table above it, which would take the line in as a row
 */
export const breakBeforeTextBlock = (previous: RootContent | undefined, html: Html, source: string): SourceEdit[] => {
    if (previous === undefined) return [];
    const above = lastBlockOf(previous);
    if (above.type !== 'paragraph' && above.type !== 'table') return [];
    const aboveEnd = above.position?.end.offset;
    const htmlStart = html.position?.start.offset;
    if (aboveEnd === undefined || htmlStart === undefined) return [];
    const adjacent = ADJACENT_LINES.exec(source.slice(aboveEnd, htmlStart));
    if (!adjacent) return [];
    // A paragraph ending in a '$$' block keeps that line end as written
    const lastLine = source.slice(source.lastIndexOf('\n', aboveEnd - 1) + 1, aboveEnd);
    if (above.type === 'paragraph' && lastLine.trimEnd().endsWith('$$')) return [];
    const trailingSpaces = adjacent[1]?.length ?? 0;
    return [
        above === previous && above.type === 'paragraph'
            ? hardBreak(aboveEnd, trailingSpaces)
            : blankLine(aboveEnd, trailingSpaces, adjacent[2] ?? ''),
    ];
};
