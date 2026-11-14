/**
 * Find a <details> element among mdast siblings the way the renderer's
 * walker does (scanDetails in render/walker.ts), but report where its
 * markdown pieces sit inside the html nodes instead of copying them out:
 * the rewrite edits those pieces in place. Contiguous lines share the
 * opening html block; blank-line-separated markdown inside parses as
 * regular sibling blocks; the element ends at the html block carrying the
 * matching </details>.
 */
import type { Html, RootContent } from 'mdast';
import { locateLeadingSummary, scanForDetailsClose, stripDetailsOpenTag } from '../../render/details';

/** A markdown piece inside an html node's value: value[start, end) */
export interface DetailsPiece {
    node: Html;
    start: number;
    end: number;
}

export interface DetailsElement {
    /** The <summary> content, re-parsed as markdown by the walker */
    summary: DetailsPiece | null;
    /** Body pieces that live inside html node values (cleaned, then re-parsed) */
    fragments: DetailsPiece[];
    /** Body blocks that mdast parsed as regular siblings */
    blocks: RootContent[];
    /** Markdown after </details> in the closing html block (re-parsed raw) */
    trailing: DetailsPiece | null;
    /** Sibling index right after the element */
    nextIndex: number;
}

const pieceIfContent = (node: Html, start: number, end: number): DetailsPiece | null =>
    node.value.slice(start, end).trim() === '' ? null : { node, start, end };

export const scanDetailsElement = (nodes: readonly RootContent[], index: number): DetailsElement | null => {
    const opening = nodes[index];
    if (opening === undefined || opening.type !== 'html') return null;
    const afterOpen = stripDetailsOpenTag(opening.value);
    if (afterOpen === null) return null;

    const element: DetailsElement = { summary: null, fragments: [], blocks: [], trailing: null, nextIndex: index + 1 };
    let contentParts = 0;
    const pushFragment = (piece: DetailsPiece | null): void => {
        if (piece === null) return;
        element.fragments.push(piece);
        contentParts += 1;
    };
    /** Take a leading <summary> off value[from…]; returns where the body starts */
    const takeSummary = (node: Html, from: number): number => {
        const located = locateLeadingSummary(node.value.slice(from));
        if (located === null) return from;
        element.summary = { node, start: from + located.summaryStart, end: from + located.summaryEnd };
        return from + located.restStart;
    };
    /** Scan value[from…] for the closing tag; true when the element ends here */
    const scanBody = (node: Html, from: number, depth: number): { closed: boolean; depth: number } => {
        const body = node.value.slice(from);
        const scan = scanForDetailsClose(body, depth);
        if (!scan.closed) {
            pushFragment(pieceIfContent(node, from, node.value.length));
            return { closed: false, depth: scan.depth };
        }
        pushFragment(pieceIfContent(node, from, from + scan.inside.length));
        element.trailing = pieceIfContent(node, node.value.length - scan.after.length, node.value.length);
        return { closed: true, depth };
    };

    const openingBody = takeSummary(opening, opening.value.length - afterOpen.length);
    let scan = scanBody(opening, openingBody, 0);
    if (scan.closed) return element;

    let nextIndex = index + 1;
    while (nextIndex < nodes.length) {
        const node = nodes[nextIndex];
        if (node === undefined) break;
        nextIndex += 1;
        if (node.type !== 'html') {
            element.blocks.push(node);
            contentParts += 1;
            continue;
        }
        // A blank line may separate <summary> from <details>: it then arrives
        // as the first content-bearing sibling instead of the opening block
        const bodyStart = element.summary === null && contentParts === 0 ? takeSummary(node, 0) : 0;
        scan = scanBody(node, bodyStart, scan.depth);
        if (scan.closed) {
            element.nextIndex = nextIndex;
            return element;
        }
    }
    element.nextIndex = nextIndex;
    return element;
};
