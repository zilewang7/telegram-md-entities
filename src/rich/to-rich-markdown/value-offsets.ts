/**
 * Where an mdast html node's value sits in the source. At the top level the
 * value is the source slice itself; inside a quote or a list item mdast
 * strips the container prefix ('> ', indentation) off every line, so each
 * value line is the tail of its source line and offsets map line by line.
 */
import type { Node } from 'mdast';
import type { OffsetMap } from './source-edits';

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

/**
 * Offset map from node.value into source, or null when the value cannot be
 * aligned with its source lines (then the node is left untouched).
 */
export const valueOffsetMap = (source: string, node: Node, value: string): OffsetMap | null => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return null;
    const slice = source.slice(start, end);
    if (slice === value) return (offset) => (offset <= value.length ? start + offset : undefined);

    const sourceLines = lineSpans(slice);
    const valueLines = lineSpans(value);
    if (sourceLines.length !== valueLines.length) return null;
    const prefixLengths: number[] = [];
    for (let index = 0; index < valueLines.length; index += 1) {
        const sourceLine = sourceLines[index];
        const valueLine = valueLines[index];
        if (sourceLine === undefined || valueLine === undefined) return null;
        const sourceText = slice.slice(sourceLine.start, sourceLine.start + sourceLine.length);
        const valueText = value.slice(valueLine.start, valueLine.start + valueLine.length);
        if (!sourceText.endsWith(valueText)) return null;
        prefixLengths.push(sourceLine.length - valueLine.length);
    }

    return (offset) => {
        for (let index = valueLines.length - 1; index >= 0; index -= 1) {
            const valueLine = valueLines[index];
            const sourceLine = sourceLines[index];
            const prefixLength = prefixLengths[index];
            if (valueLine === undefined || sourceLine === undefined || prefixLength === undefined) {
                return undefined;
            }
            if (offset >= valueLine.start) {
                return start + sourceLine.start + prefixLength + (offset - valueLine.start);
            }
        }
        return undefined;
    };
};
