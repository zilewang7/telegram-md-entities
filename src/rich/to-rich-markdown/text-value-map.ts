/**
 * Where the characters of an mdast text node's value sit in the source.
 * The value is not a copy of its source: mdast drops each line's container
 * prefix ('> ', indentation) and the blanks before a soft break, and
 * decodes backslash escapes and character references. Each value line is
 * placed on its source line twice: forward from its start, decoding
 * escapes, and backward from its end over the characters both share; each
 * pass stops at the first character reference (and the backward one at the
 * first backslash), so neither can drift. A column neither pass placed
 * maps to nothing.
 */
import type { Text } from 'mdast';

export type ValueToSource = (offset: number) => number | undefined;

const TRAILING_BLANKS = /[ \t\r]+$/;
const LEADING_CONTAINER_PREFIX = /^[ \t>]*/;
const ASCII_PUNCTUATION = /^[!-/:-@[-`{-~]$/;
const REFERENCE_BODY = '&(?:#\\d{1,7}|#[xX][\\da-fA-F]{1,6}|[A-Za-z][A-Za-z\\d]{1,31});';
const REFERENCE_AT_START = new RegExp(`^${REFERENCE_BODY}`);
const REFERENCE_AT_END = new RegExp(`${REFERENCE_BODY}$`);

interface LineSpan {
    start: number;
    length: number;
}

const lineSpans = (text: string): LineSpan[] => {
    const spans: LineSpan[] = [];
    let start = 0;
    for (const line of text.split('\n')) {
        spans.push({ start, length: line.length });
        start += line.length + 1;
    }
    return spans;
};

/** One line of each, without the blanks a soft break drops */
interface LinePair {
    source: string;
    /** Offset of source[0] in the whole document */
    sourceBase: number;
    value: string;
    /** A continuation line, whose source starts with the container prefix */
    continuation: boolean;
}

/** Forward: escapes decoded, a character reference or a mismatch ends it */
const placeForward = (pair: LinePair, placed: (number | undefined)[]): void => {
    let sourceIndex = pair.continuation ? (LEADING_CONTAINER_PREFIX.exec(pair.source)?.[0].length ?? 0) : 0;
    let column = 0;
    while (column < pair.value.length && sourceIndex < pair.source.length) {
        const char = pair.source[sourceIndex];
        const next = pair.source[sourceIndex + 1] ?? '';
        if (char === '\\' && ASCII_PUNCTUATION.test(next)) {
            if (next !== pair.value[column]) return;
            placed[column] = pair.sourceBase + sourceIndex + 1;
            sourceIndex += 2;
        } else if (char === '&' && REFERENCE_AT_START.test(pair.source.slice(sourceIndex))) {
            return;
        } else if (char === pair.value[column]) {
            placed[column] = pair.sourceBase + sourceIndex;
            sourceIndex += 1;
        } else {
            return;
        }
        column += 1;
    }
};

/** Backward: equal characters only, up to a backslash or a character reference */
const placeBackward = (pair: LinePair, placed: (number | undefined)[]): void => {
    let sourceIndex = pair.source.length - 1;
    let column = pair.value.length - 1;
    while (column >= 0 && sourceIndex >= 0) {
        const char = pair.source[sourceIndex];
        if (char === '\\' || char !== pair.value[column]) return;
        if (char === ';' && REFERENCE_AT_END.test(pair.source.slice(0, sourceIndex + 1))) return;
        placed[column] = pair.sourceBase + sourceIndex;
        sourceIndex -= 1;
        column -= 1;
    }
};

/** null when the node has no position or its lines do not pair up */
export const textValueToSource = (source: string, node: Text): ValueToSource | null => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return null;
    const slice = source.slice(start, end);
    const sourceLines = lineSpans(slice);
    const valueLines = lineSpans(node.value);
    if (sourceLines.length !== valueLines.length) return null;

    const placed: (number | undefined)[] = new Array<number | undefined>(node.value.length).fill(undefined);
    for (const [index, sourceLine] of sourceLines.entries()) {
        const valueLine = valueLines[index];
        if (valueLine === undefined) return null;
        const isLast = index === sourceLines.length - 1;
        const rawSource = slice.slice(sourceLine.start, sourceLine.start + sourceLine.length);
        const rawValue = node.value.slice(valueLine.start, valueLine.start + valueLine.length);
        const pair: LinePair = {
            source: isLast ? rawSource : rawSource.replace(TRAILING_BLANKS, ''),
            sourceBase: start + sourceLine.start,
            value: isLast ? rawValue : rawValue.replace(TRAILING_BLANKS, ''),
            continuation: index > 0,
        };
        const linePlaced: (number | undefined)[] = [];
        placeForward(pair, linePlaced);
        placeBackward(pair, linePlaced);
        linePlaced.forEach((position, column) => {
            placed[valueLine.start + column] = position;
        });
    }
    return (offset) => placed[offset];
};
