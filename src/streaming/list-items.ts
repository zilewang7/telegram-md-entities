/**
 * Just enough list-item structure for the streaming block scan: where an
 * item's content column is, so a fence inside a (nested) list item is
 * found and closed at the item's indentation. CommonMark ends the item at a
 * closer written at column 0, and that closer then opens a new fence.
 */

const TAB_STOP = 4;

/** Visual column after text[0, end), tabs advancing to the next stop */
export const columnAt = (text: string, end: number): number => {
    let column = 0;
    for (let index = 0; index < end; index += 1) {
        column = text[index] === '\t' ? column + TAB_STOP - (column % TAB_STOP) : column + 1;
    }
    return column;
};

/** Length of the leading spaces/tabs of text */
export const indentLength = (text: string): number => text.length - text.trimStart().length;

/** Index after skipping leading whitespace that reaches at most `columns` */
export const skipColumns = (text: string, columns: number): number => {
    let index = 0;
    while (index < text.length && (text[index] === ' ' || text[index] === '\t')) {
        if (columnAt(text, index + 1) > columns) break;
        index += 1;
    }
    return index;
};

const THEMATIC_BREAK = /^[ ]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_MARKER = /^([-*+]|\d{1,9}[.)])(?=[ \t]|$)/;

export interface ListMarker {
    /** Index in the line where the item's content starts */
    contentIndex: number;
    /** Visual column of the item's content (what continuation lines indent to) */
    contentColumn: number;
}

/**
 * The list marker at text[at…], if one opens an item there. Content starts
 * after 1–4 spaces; with none (end of line) or 5+, one column after the
 * marker (the rest is then indented code, which the scan does not need).
 */
export const listMarkerAt = (text: string, at: number): ListMarker | null => {
    if (THEMATIC_BREAK.test(text)) return null;
    const marker = LIST_MARKER.exec(text.slice(at));
    if (!marker) return null;
    const markerEnd = at + marker[0].length;
    const spaces = indentLength(text.slice(markerEnd));
    const spaceColumns = columnAt(text, markerEnd + spaces) - columnAt(text, markerEnd);
    const contentIndex = spaces === 0 || spaceColumns > 4 ? Math.min(markerEnd + 1, text.length) : markerEnd + spaces;
    const contentColumn = spaces === 0 || spaceColumns > 4 ? columnAt(text, markerEnd) + 1 : columnAt(text, contentIndex);
    return { contentIndex, contentColumn };
};
