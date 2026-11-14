/**
 * Edits that make a piece of source show as literal text once it is read as
 * markdown: used for HTML the package shows literally (an unknown tag, a
 * comment) but Telegram would interpret. '<' becomes '&lt;' so neither
 * parser sees a tag; the characters that could open a markdown construct
 * get a backslash. Only what matters is escaped: '=' only when doubled
 * (==mark==), line-start block markers only at a line start.
 */
import type { SourceEdit } from './source-edits';

const ALWAYS_ESCAPED = new Set(['\\', '`', '*', '_', '[', ']', '~', '|', '&', '$']);
const LINE_START_MARKERS = new Set(['#', '>', '-', '+', '=']);

const isAtLineStart = (text: string, index: number): boolean => {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const char = text[cursor];
        if (char === '\n') return true;
        if (char !== ' ' && char !== '\t') return false;
    }
    // The start of the piece is never a line start: it begins with '<'
    return false;
};

/** '1.' / '1)' after leading spaces: the punctuation would open an ordered list */
const endsOrderedListMarker = (text: string, index: number): boolean => {
    let cursor = index - 1;
    if (!/[0-9]/.test(text[cursor] ?? '')) return false;
    while (/[0-9]/.test(text[cursor] ?? '')) cursor -= 1;
    return isAtLineStart(text, cursor + 1);
};

const needsBackslash = (text: string, index: number): boolean => {
    const char = text[index] ?? '';
    if (ALWAYS_ESCAPED.has(char)) return true;
    if (char === '=' && (text[index - 1] === '=' || text[index + 1] === '=')) return true;
    if (LINE_START_MARKERS.has(char) && isAtLineStart(text, index)) return true;
    return (char === '.' || char === ')') && endsOrderedListMarker(text, index);
};

/**
 * Whether the newline at an index must stay soft because it is not
 * paragraph text there: the next line opens an html block, or the line is
 * already inside one
 */
export type SoftBreakTest = (newlineIndex: number) => boolean;

const NEVER_SOFT: SoftBreakTest = () => false;

/**
 * A newline in escaped html becomes a paragraph's soft break, which
 * Telegram joins with a space; make it a hard one ('\' before it) when a
 * line of paragraph text follows. Not before a blank line, nor where the
 * caller says the line is html (a '\' there, or ending a paragraph, shows
 * literally).
 */
const needsHardBreak = (text: string, index: number, staysSoft: SoftBreakTest): boolean => {
    const lineEnd = text.indexOf('\n', index + 1);
    const nextLine = text.slice(index + 1, lineEnd === -1 ? text.length : lineEnd);
    return nextLine.trim() !== '' && !staysSoft(index);
};

/**
 * Escape text[start, end) as literal. `text` is the whole piece the range
 * lives in (for line checks); edits are relative to it.
 */
export const literalEscapeEdits = (
    text: string,
    start: number,
    end: number,
    staysSoft: SoftBreakTest = NEVER_SOFT
): SourceEdit[] => {
    const edits: SourceEdit[] = [];
    for (let index = start; index < end; index += 1) {
        const char = text[index] ?? '';
        if (char === '<') {
            edits.push({ start: index, end: index + 1, text: '&lt;' });
        } else if (char === '\n') {
            if (needsHardBreak(text, index, staysSoft)) edits.push({ start: index, end: index + 1, text: '\\\n' });
        } else if (needsBackslash(text, index)) {
            edits.push({ start: index, end: index + 1, text: `\\${char}` });
        }
    }
    return edits;
};
