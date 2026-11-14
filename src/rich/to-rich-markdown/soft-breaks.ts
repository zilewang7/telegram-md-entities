/**
 * Telegram's rich parser joins the lines of a paragraph with a space (a
 * soft line break, as in HTML), while this package and the entities path
 * keep every newline. Writing each soft break as a hard one ('\' before
 * the newline) makes Telegram keep the line too; the renderer reads both
 * forms as the same newline.
 */
import { formulaLineEndings } from './display-math';
import type { SourceEdit } from './source-edits';

/**
 * Edits for the line endings inside a text node's source range
 * source[start, end). The trailing spaces of a line are part of a soft
 * break (the parser drops them) but would stay visible before a hard one,
 * so they are replaced along with the newline. Line endings inside and
 * around a '$$…$$' block stay as written (see display-math.ts).
 */
export const softBreakEdits = (source: string, start: number, end: number): SourceEdit[] => {
    const untouched = formulaLineEndings(source, start, end);
    const edits: SourceEdit[] = [];
    for (let index = start; index < end; index += 1) {
        if (source[index] !== '\n' || untouched.has(index)) continue;
        let lineEnd = index;
        while (lineEnd > start && (source[lineEnd - 1] === ' ' || source[lineEnd - 1] === '\t')) lineEnd -= 1;
        edits.push({ start: lineEnd, end: index + 1, text: '\\\n' });
    }
    return edits;
};
