/**
 * Telegram's rich parser joins the lines of a paragraph with a space (a
 * soft line break, as in HTML), while this package and the entities path
 * keep every newline. Writing each soft break as a hard one ('\' before
 * the newline) makes Telegram keep the line too; the renderer reads both
 * forms as the same newline. In a piece Telegram reads as HTML text the
 * '\' would show: there a <br> goes before the line end (measured: 'a<br>\nb'
 * shows two lines, also in a quote). This package reads a <br> and a line
 * end after it as two line breaks in a <details> body, but as one in a
 * <summary>: the display referee holds for a <summary> only.
 */
import type { SourceSpan } from './dollar-runs';
import type { PieceReading } from './piece-reading';
import type { SourceEdit } from './source-edits';

/** Where a text node sits, as far as its line ends care */
export interface SoftBreakPlacement {
    /** Right after a bare URL: a '\' there would join the URL */
    followsBareUrl: boolean;
    reading: PieceReading;
}

/**
 * Whether a '\' at lineEnd would join the URL right before the node: a
 * bare URL runs on to the next whitespace or '<', so on the node's first
 * line nothing in between may end it (a ')' or '.' the URL left out does
 * not)
 */
const gluedToBareUrl = (source: string, within: SourceSpan, newline: number, lineEnd: number): boolean =>
    !source.slice(within.start, newline).includes('\n') && !/[\s<]/.test(source.slice(within.start, lineEnd));

const hardBreakOf = (
    source: string,
    within: SourceSpan,
    newline: number,
    lineEnd: number,
    placement: SoftBreakPlacement
): string => {
    // The newline stays after it: the next line may start with a container prefix
    if (placement.reading === 'html') return '<br>\n';
    return placement.followsBareUrl && gluedToBareUrl(source, within, newline, lineEnd) ? '  \n' : '\\\n';
};

/**
 * Edits for the line endings inside a text node's source range `within`.
 * The trailing spaces of a line are part of a soft break (the parser drops
 * them) but would stay visible before a hard one, so they are replaced
 * along with the newline. Line endings in `untouched` (inside and around a
 * '$$…$$' block, see display-math.ts) stay as written. Right after a bare
 * URL the hard break is two spaces: a '\' would become part of the URL.
 */
export const softBreakEdits = (
    source: string,
    within: SourceSpan,
    untouched: ReadonlySet<number>,
    placement: SoftBreakPlacement
): SourceEdit[] => {
    const edits: SourceEdit[] = [];
    for (let index = within.start; index < within.end; index += 1) {
        if (source[index] !== '\n' || untouched.has(index)) continue;
        // Trailing spaces may also sit just before the node (after a link
        // or a strong they belong to no node)
        let lineEnd = index;
        while (lineEnd > 0 && (source[lineEnd - 1] === ' ' || source[lineEnd - 1] === '\t')) lineEnd -= 1;
        edits.push({ start: lineEnd, end: index + 1, text: hardBreakOf(source, within, index, lineEnd, placement) });
    }
    return edits;
};
