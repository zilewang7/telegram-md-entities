/**
 * Line-level scan of a streaming buffer: tracks whether the tail sits inside
 * an unclosed fenced code block (which suppresses all inline repair) and
 * where the current leaf block begins (the region inline repair may scan).
 */
import { columnAt, indentLength, listMarkerAt, skipColumns } from './list-items';

export interface OpenFence {
    marker: '`' | '~';
    size: number;
    /**
     * Prefix the closing fence line must carry: the container prefix ('> '
     * chains), plus the opener's own indentation (list markers as spaces)
     * once the buffer has list items. In a list item a closer left of the
     * item's content would end the item and open a new fence; at the
     * opener's column it always closes, also where a lazy line hides the
     * item. Without lists the closer stays at the container's column.
     */
    containerPrefix: string;
    /** Content column of the list item holding the fence; 0 outside lists */
    itemColumn: number;
}

export interface BlockState {
    openFence: OpenFence | null;
    /** Raw index where the current leaf block starts (inline-scan region) */
    leafBlockStart: number;
}

export const QUOTE_PREFIX = /^(?:[ ]{0,3}>[ ]?)+/;
export const FENCE_LINE = /^[ ]{0,3}(`{3,}|~{3,})(.*)$/;
/** Lines that start a fresh leaf block — inline constructs never span them */
export const LEAF_RESET = /^(?:#{1,6}\s|[-*+]\s|\d{1,9}[.)]\s|\||[ ]{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$)/;

const isClosingFence = (text: string, fence: OpenFence): boolean => {
    const match = text.match(FENCE_LINE);
    return (
        match?.[1] !== undefined &&
        match[1][0] === fence.marker &&
        match[1].length >= fence.size &&
        match[2]?.trim() === ''
    );
};

/**
 * What a line inside an open fence is: more content, the closing fence
 * (at the item's indentation for a fence in a list item), or a line left of
 * the item's content, which ends the item and the fence with it.
 */
const readFenceLine = (stripped: string, isBlank: boolean, fence: OpenFence): 'content' | 'closer' | 'outside' => {
    if (fence.itemColumn === 0) return isClosingFence(stripped, fence) ? 'closer' : 'content';
    if (!isBlank && columnAt(stripped, indentLength(stripped)) < fence.itemColumn) return 'outside';
    return isClosingFence(stripped.slice(skipColumns(stripped, fence.itemColumn)), fence) ? 'closer' : 'content';
};

/** The same columns in whitespace: list markers become spaces, tabs stay */
const asIndentation = (text: string): string => text.replace(/[^\t]/g, ' ');

const quoteDepth = (prefix: string): number => prefix.split('>').length - 1;

const HEADING_OR_BREAK = /^[ ]{0,3}(?:#{1,6}(?:\s|$)|([-*_])(?:[ \t]*\1){2,}[ \t]*$)/;

/**
 * A line that only continues the open paragraph (CommonMark's lazy
 * continuation): it does not end the list item even when it is not
 * indented, so it must not pop the item.
 */
const isLazyContinuation = (stripped: string, itemColumns: readonly number[]): boolean => {
    const position = indentLength(stripped);
    return (
        listMarkerAt(stripped, position) === null &&
        !FENCE_LINE.test(stripped.slice(skipColumns(stripped, itemColumns[itemColumns.length - 1] ?? 0))) &&
        !HEADING_OR_BREAK.test(stripped)
    );
};

interface LineItems {
    /** Where the line's content starts */
    contentIndex: number;
    /** The line opened an item with nothing after its marker */
    openedEmptyItem: boolean;
}

/**
 * Push the items whose markers open on this line (`1. - x` opens two) and
 * say where the line's content starts: after the innermost new marker, or
 * past the current item's indentation on a continuation line.
 */
const openItemsOnLine = (stripped: string, itemColumns: number[]): LineItems => {
    let position = indentLength(stripped);
    let openedAny = false;
    for (;;) {
        const parentColumn = itemColumns[itemColumns.length - 1] ?? 0;
        // A marker indented 4+ past its parent's content is code, not an item
        if (columnAt(stripped, position) - parentColumn > 3) break;
        const marker = listMarkerAt(stripped, position);
        if (marker === null) break;
        itemColumns.push(marker.contentColumn);
        position = marker.contentIndex;
        openedAny = true;
    }
    return openedAny
        ? { contentIndex: position, openedEmptyItem: stripped.slice(position).trim() === '' }
        : { contentIndex: skipColumns(stripped, itemColumns[itemColumns.length - 1] ?? 0), openedEmptyItem: false };
};

export const scanBlockState = (buffer: string): BlockState => {
    let openFence: OpenFence | null = null;
    let leafBlockStart = 0;
    let offset = 0;
    // Content columns of the open list items (innermost last), and the
    // quote depth they live at
    let itemColumns: number[] = [];
    let itemQuoteDepth = 0;
    // The previous line left a paragraph open (lazy lines may continue it)
    let paragraphOpen = false;
    let sawListItem = false;
    // An item that opened empty ends at a blank line (it may begin with at
    // most one blank line, and then holds nothing)
    let emptyItemOpen = false;

    for (const line of buffer.split('\n')) {
        const lineStart = offset;
        offset += line.length + 1;
        const nextLineStart = offset;

        const quoteMatch = line.match(QUOTE_PREFIX);
        const containerPrefix = quoteMatch?.[0] ?? '';
        const stripped = quoteMatch ? line.slice(containerPrefix.length) : line;
        const isBlank = stripped.trim() === '';

        const continuesParagraph = paragraphOpen && !isBlank;
        paragraphOpen = false;

        if (openFence) {
            const reading = readFenceLine(stripped, isBlank, openFence);
            if (reading === 'closer') {
                openFence = null;
                leafBlockStart = nextLineStart;
            }
            if (reading !== 'outside') continue;
            // A line left of the item's content ends the item, and the fence
            // with it; the line itself is read as a new block below
            openFence = null;
            leafBlockStart = lineStart;
        }

        if (!isBlank) {
            if (quoteDepth(containerPrefix) !== itemQuoteDepth) {
                itemColumns = [];
                itemQuoteDepth = quoteDepth(containerPrefix);
            }
            const indentColumn = columnAt(stripped, indentLength(stripped));
            const lazy = continuesParagraph && isLazyContinuation(stripped, itemColumns);
            while (!lazy && itemColumns.length > 0 && indentColumn < (itemColumns[itemColumns.length - 1] ?? 0)) {
                itemColumns.pop();
            }
        }

        if (isBlank && emptyItemOpen) itemColumns.pop();
        const lineItems = isBlank ? { contentIndex: 0, openedEmptyItem: false } : openItemsOnLine(stripped, itemColumns);
        const contentIndex = lineItems.contentIndex;
        emptyItemOpen = lineItems.openedEmptyItem;
        sawListItem = sawListItem || itemColumns.length > 0;

        const fence = stripped.slice(contentIndex).match(FENCE_LINE);
        if (fence?.[1]) {
            const marker = fence[1][0] === '~' ? '~' : '`';
            // Backtick fences forbid backticks in the info string
            if (marker === '~' || !fence[2]?.includes('`')) {
                const itemColumn = itemColumns[itemColumns.length - 1] ?? 0;
                const fenceIndex = contentIndex + indentLength(stripped.slice(contentIndex));
                openFence = {
                    marker,
                    size: fence[1].length,
                    containerPrefix: sawListItem
                        ? containerPrefix + asIndentation(stripped.slice(0, fenceIndex))
                        : containerPrefix,
                    itemColumn,
                };
                leafBlockStart = nextLineStart;
                continue;
            }
        }

        if (isBlank) {
            leafBlockStart = nextLineStart;
        } else if (LEAF_RESET.test(stripped)) {
            leafBlockStart = lineStart;
        }
        paragraphOpen = !isBlank && !HEADING_OR_BREAK.test(stripped);
    }

    return { openFence, leafBlockStart: Math.min(leafBlockStart, buffer.length) };
};
