/**
 * Telegram's rich parser joins the lines of a paragraph with a space (a
 * soft line break, as in HTML), while this package and the entities path
 * keep every newline. Writing each soft break as a hard one ('\' before
 * the newline) makes Telegram keep the line too; the renderer reads both
 * forms as the same newline.
 */
import type { SourceEdit } from './source-edits';

/**
 * Edits for the line endings inside a text node's source range
 * source[start, end). The trailing spaces of a line are part of a soft
 * break (the parser drops them) but would stay visible before a hard one,
 * so they are replaced along with the newline. Line endings in
 * `untouched` (inside and around a '$$…$$' block, see display-math.ts)
 * stay as written.
 */
export const softBreakEdits = (
    source: string,
    start: number,
    end: number,
    untouched: ReadonlySet<number>,
    followsBareUrl: boolean
): SourceEdit[] => {
    const edits: SourceEdit[] = [];
    for (let index = start; index < end; index += 1) {
        if (source[index] !== '\n' || untouched.has(index)) continue;
        // Trailing spaces may also sit just before the node (after a link
        // or a strong they belong to no node)
        let lineEnd = index;
        while (lineEnd > 0 && (source[lineEnd - 1] === ' ' || source[lineEnd - 1] === '\t')) lineEnd -= 1;
        // A '\' right after a bare URL would become part of the URL; two
        // trailing spaces are the other hard-break form
        const hardBreak = lineEnd <= start && followsBareUrl ? '  \n' : '\\\n';
        edits.push({ start: lineEnd, end: index + 1, text: hardBreak });
    }
    return edits;
};
