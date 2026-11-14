/**
 * An html block may interrupt a paragraph ('文字\n<p>…</p>'). Once its
 * leading tag is escaped it no longer can: its lines continue the
 * paragraph above, which Telegram joins with a space. A hard break at the
 * end of the paragraph keeps the escaped block on its own line.
 */
import type { Html, RootContent } from 'mdast';
import type { SourceEdit } from './source-edits';

/** Only the line end (and the next line's container prefix) between the two */
const ADJACENT_LINES = /^([ \t]*)\n[ \t>]*$/;

export const breakBeforeTextBlock = (
    previous: RootContent | undefined,
    html: Html,
    source: string
): SourceEdit[] => {
    if (previous?.type !== 'paragraph') return [];
    const paragraphEnd = previous.position?.end.offset;
    const htmlStart = html.position?.start.offset;
    if (paragraphEnd === undefined || htmlStart === undefined) return [];
    const adjacent = ADJACENT_LINES.exec(source.slice(paragraphEnd, htmlStart));
    if (!adjacent) return [];
    // A paragraph ending in a '$$' block keeps that line end as written
    const lastLine = source.slice(source.lastIndexOf('\n', paragraphEnd - 1) + 1, paragraphEnd);
    if (lastLine.trimEnd().endsWith('$$')) return [];
    const trailingSpaces = adjacent[1]?.length ?? 0;
    return [{ start: paragraphEnd, end: paragraphEnd + trailingSpaces + 1, text: '\\\n' }];
};
