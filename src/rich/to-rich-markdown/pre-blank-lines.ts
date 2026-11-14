/**
 * A '<pre>' html block may hold blank lines in markdown (CommonMark type 1
 * runs to '</pre>'), but Telegram's rich parser ends the html block at the
 * first blank line (measured: the rest became a separate paragraph). So a
 * blank line is taken out of the source and its newline written as
 * '&#10;' at the end of the line above, which the HTML parser reads as the
 * same newline. The whole blank line goes, container prefix included ('>'
 * alone is a blank line inside a quote), so no line of the block is blank
 * and the next line keeps its own prefix.
 */
import type { OffsetMap, SourceEdit } from './source-edits';

const NEWLINE_REFERENCE = '&#10;';
/** <pre> as the block's leading tag (an open tag, like tokenizeHtml reads it) */
const LEADING_PRE_TAG = /^\s*<pre(?=[\s/>])/i;

export const isPreBlock = (value: string): boolean => LEADING_PRE_TAG.test(value);

/** Source edits for the blank lines of a kept '<pre>' block's value */
export const preBlankLineEdits = (value: string, map: OffsetMap, source: string): SourceEdit[] => {
    const edits: SourceEdit[] = [];
    let newlineBefore = value.indexOf('\n');
    while (newlineBefore !== -1) {
        const newlineAfter = value.indexOf('\n', newlineBefore + 1);
        if (newlineAfter === -1) break;
        if (value.slice(newlineBefore + 1, newlineAfter).trim() === '') {
            const start = map(newlineBefore);
            const end = map(newlineAfter);
            // Between the two newlines only the blank line's prefix may sit
            const removable = start !== undefined && end !== undefined && /^\n[ \t>]*$/.test(source.slice(start, end));
            if (removable) edits.push({ start, end, text: NEWLINE_REFERENCE });
        }
        newlineBefore = newlineAfter;
    }
    return edits;
};
