/**
 * Telegram's rich parser joins the lines of a paragraph with a space (a
 * soft line break, as in HTML), while this package and the entities path
 * keep every newline. Writing each soft break as a hard one ('\' before
 * the newline) makes Telegram keep the line too; the renderer reads both
 * forms as the same newline.
 */
import { displayMathSpans, type SourceSpan } from './dollar-runs';
import type { SourceEdit } from './source-edits';

const isInside = (spans: readonly SourceSpan[], index: number): boolean =>
    spans.some((span) => index >= span.start && index < span.end);

/**
 * Edits for the line endings inside a text node's source range
 * source[start, end). The trailing spaces of a line are part of a soft
 * break (the parser drops them) but would stay visible before a hard one,
 * so they are replaced along with the newline. Line endings inside a
 * '$$…$$' formula stay as written: Telegram reads them as part of the
 * display math, and a backslash there breaks the formula.
 */
export const softBreakEdits = (source: string, start: number, end: number): SourceEdit[] => {
    const formulas = displayMathSpans(source, start, end);
    const edits: SourceEdit[] = [];
    for (let index = start; index < end; index += 1) {
        if (source[index] !== '\n' || isInside(formulas, index)) continue;
        let lineEnd = index;
        while (lineEnd > start && (source[lineEnd - 1] === ' ' || source[lineEnd - 1] === '\t')) lineEnd -= 1;
        edits.push({ start: lineEnd, end: index + 1, text: '\\\n' });
    }
    return edits;
};
