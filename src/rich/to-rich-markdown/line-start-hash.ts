/**
 * Telegram's rich parser reads a line that starts with '#' as a heading
 * even without a space after it: '#3 说得对' shows a heading "3 说得对"
 * (measured in paragraphs, on their continuation lines, in list items and
 * in quotes; not in table cells), and '#3 说得对\n---' a heading and a
 * divider. This package and the entities path show text there, so a '#'
 * that starts a line of a paragraph or a setext heading gets a backslash
 * ('\#3' shows "#3" on Telegram too).
 */
import type { SourceSpan } from './dollar-runs';
import type { SourceEdit } from './source-edits';

/** Only a container prefix (quote markers, indentation) between the line start and offset */
const startsSourceLine = (source: string, offset: number): boolean => {
    const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
    return /^[ \t>]*$/.test(source.slice(lineStart, offset));
};

/**
 * Escapes for the '#' that start a line of one text node of a paragraph,
 * source[within.start, within.end). `paragraphStart` is where the
 * paragraph's first line starts (after a list marker, say). Offsets in
 * `covered` are rewritten already: a link's '<a>' keeps the line from
 * being a heading as well.
 */
export const lineStartHashEdits = (
    source: string,
    within: SourceSpan,
    paragraphStart: number,
    covered: ReadonlySet<number>
): SourceEdit[] => {
    const lineStarts: number[] = [];
    if (within.start === paragraphStart || startsSourceLine(source, within.start)) lineStarts.push(within.start);
    for (let index = within.start; index < within.end; index += 1) {
        if (source[index] !== '\n') continue;
        let lineStart = index + 1;
        while (lineStart < within.end && (source[lineStart] === ' ' || source[lineStart] === '\t' || source[lineStart] === '>')) {
            lineStart += 1;
        }
        if (lineStart < within.end) lineStarts.push(lineStart);
    }
    return lineStarts
        .filter((offset) => source[offset] === '#' && !covered.has(offset))
        .map((offset) => ({ start: offset, end: offset + 1, text: '\\#' }));
};
