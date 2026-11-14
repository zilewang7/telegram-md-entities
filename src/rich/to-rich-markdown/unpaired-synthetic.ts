/**
 * Streaming repair appends closers ('**', '||', '`'…) to a growing buffer.
 * The parser may refuse to pair some of them; those are then plain text,
 * which the streaming render strips off its output. The rewrite deletes
 * them from the source instead.
 */
import type { Node, Root } from 'mdast';
import type { SourceEdit } from './source-edits';

/** The appended closers: source[start, end) */
export interface SyntheticRange {
    start: number;
    end: number;
}

/** Literal text ranges (text nodes) overlapping [start, end) */
const textRangesWithin = (node: Node, start: number, end: number, found: SourceEdit[]): void => {
    const nodeStart = node.position?.start.offset;
    const nodeEnd = node.position?.end.offset;
    if (nodeStart === undefined || nodeEnd === undefined) return;
    if (nodeEnd <= start || nodeStart >= end) return;
    if (node.type === 'text') {
        found.push({ start: Math.max(start, nodeStart), end: Math.min(end, nodeEnd), text: '' });
        return;
    }
    const children: unknown = 'children' in node ? node.children : undefined;
    if (!Array.isArray(children)) return;
    for (const child of children) textRangesWithin(child, start, end, found);
};

/**
 * Deletions for the closers that ended up as text. Closers inside a
 * <details> html block are re-parsed separately and stay.
 */
export const unpairedSyntheticEdits = (root: Root, synthetic: SyntheticRange): SourceEdit[] => {
    const found: SourceEdit[] = [];
    if (synthetic.end > synthetic.start) textRangesWithin(root, synthetic.start, synthetic.end, found);
    return found;
};
