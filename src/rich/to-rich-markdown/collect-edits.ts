/**
 * Walk the package's own parse of a markdown source and collect the edits
 * that make Telegram's rich parser read it the same way. The walk mirrors
 * the renderer's (render/walker.ts): same parser and options, same
 * <details> handling (pieces inside html are cleaned and re-parsed as
 * markdown), same per-leaf-block html tag pairing. Code, math, tables,
 * links and escapes produce no edits.
 */
import type { Html, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import { match } from 'ts-pattern';
import { cleanDetailsFragmentWithOffsets } from '../../render/details';
import { parseMarkdown } from '../../render/parse';
import type { SpoilerMode } from '../../render/spoiler/micromark-spoiler';
import { isUnderscoreStrong } from '../../render/strong-delimiter';
import { scanDetailsElement, type DetailsElement, type DetailsPiece } from './details-scan';
import { htmlValueEdits, type SpoilerSpanState } from './html-edits';
import { mapEdits, shiftEdits, type OffsetMap, type SourceEdit } from './source-edits';
import { unpairedSyntheticEdits, type SyntheticRange } from './unpaired-synthetic';
import { valueOffsetMap } from './value-offsets';

export interface RewriteOptions {
    underline: boolean;
    spoilerMode: SpoilerMode;
}

interface CollectContext {
    source: string;
    options: RewriteOptions;
    edits: SourceEdit[];
}

/**
 * Replace a delimiter-wrapped node's delimiters, keeping its content. The
 * opening delimiter is the run of the node's first character, up to its
 * first child; the closing one the run of its last character, back to its
 * last child (a line's indentation between the two stays). Works for any
 * delimiter length.
 */
const wrapDelimiters = (node: Parent, open: string, close: string, ctx: CollectContext): void => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    const contentStart = node.children[0]?.position?.start.offset;
    const contentEnd = node.children[node.children.length - 1]?.position?.end.offset;
    if (start === undefined || end === undefined) return;
    if (contentStart === undefined || contentEnd === undefined) return;
    if (contentStart <= start || contentEnd >= end) return;

    const openChar = ctx.source[start];
    let openEnd = start;
    while (openEnd < contentStart && ctx.source[openEnd] === openChar) openEnd += 1;
    const closeChar = ctx.source[end - 1];
    let closeStart = end;
    while (closeStart > contentEnd && ctx.source[closeStart - 1] === closeChar) closeStart -= 1;

    ctx.edits.push(
        { start, end: openEnd, text: open },
        { start: closeStart, end, text: close }
    );
};

const collectHtml = (node: Html, isBlock: boolean, spans: SpoilerSpanState, ctx: CollectContext): void => {
    const map = valueOffsetMap(ctx.source, node, node.value);
    if (map === null) return;
    ctx.edits.push(...mapEdits(htmlValueEdits(node.value, isBlock, spans), map));
};

const collectPhrasing = (
    nodes: readonly PhrasingContent[],
    spans: SpoilerSpanState,
    ctx: CollectContext
): void => {
    for (const node of nodes) {
        match(node)
            .with({ type: 'strong' }, (strong) => {
                const underline = ctx.options.underline && isUnderscoreStrong(strong, ctx.source);
                wrapDelimiters(strong, underline ? '<u>' : '<b>', underline ? '</u>' : '</b>', ctx);
                collectPhrasing(strong.children, spans, ctx);
            })
            .with({ type: 'emphasis' }, (emphasis) => {
                wrapDelimiters(emphasis, '<i>', '</i>', ctx);
                collectPhrasing(emphasis.children, spans, ctx);
            })
            .with({ type: 'delete' }, (deleted) => {
                wrapDelimiters(deleted, '<s>', '</s>', ctx);
                collectPhrasing(deleted.children, spans, ctx);
            })
            .with({ type: 'spoiler' }, (spoiler) => {
                wrapDelimiters(spoiler, '<tg-spoiler>', '</tg-spoiler>', ctx);
                collectPhrasing(spoiler.children, spans, ctx);
            })
            .with({ type: 'link' }, { type: 'linkReference' }, (link) =>
                collectPhrasing(link.children, spans, ctx)
            )
            .with({ type: 'html' }, (html) => collectHtml(html, false, spans, ctx))
            .otherwise(() => undefined);
    }
};

/** A fresh tag-pairing scope: the renderer flushes open tags at every block end */
const newSpans = (): SpoilerSpanState => ({ open: 0 });

const collectBlock = (node: RootContent, ctx: CollectContext): void => {
    match(node)
        .with({ type: 'paragraph' }, { type: 'heading' }, (leaf) =>
            collectPhrasing(leaf.children, newSpans(), ctx)
        )
        .with({ type: 'table' }, (table) => {
            for (const row of table.children) {
                for (const cell of row.children) collectPhrasing(cell.children, newSpans(), ctx);
            }
        })
        .with({ type: 'html' }, (html) => collectHtml(html, true, newSpans(), ctx))
        .with({ type: 'blockquote' }, { type: 'listItem' }, { type: 'footnoteDefinition' }, (container) =>
            collectSiblings(container.children, ctx)
        )
        .with({ type: 'list' }, (list) => {
            for (const item of list.children) collectSiblings(item.children, ctx);
        })
        .otherwise(() => undefined);
};

const parseSource = (source: string, options: RewriteOptions): Root =>
    parseMarkdown(source, { spoiler: true, spoilerMode: options.spoilerMode });

/** Collect edits for a markdown string parsed on its own (as the walker re-parses) */
const editsForMarkdown = (source: string, options: RewriteOptions): SourceEdit[] => {
    const ctx: CollectContext = { source, options, edits: [] };
    collectSiblings(parseSource(source, options).children, ctx);
    return ctx.edits;
};

/** A piece the walker cleans (<br> → newline, trimmed) before re-parsing */
const cleanedPieceEdits = (piece: DetailsPiece, options: RewriteOptions): SourceEdit[] => {
    const raw = piece.node.value.slice(piece.start, piece.end);
    const cleaned = cleanDetailsFragmentWithOffsets(raw);
    const toRaw: OffsetMap = (offset) => cleaned.rawOffsets[offset];
    return shiftEdits(mapEdits(editsForMarkdown(cleaned.text, options), toRaw), piece.start);
};

/** A piece the walker re-parses as it is (the markdown trailing </details>) */
const rawPieceEdits = (piece: DetailsPiece, options: RewriteOptions): SourceEdit[] =>
    shiftEdits(editsForMarkdown(piece.node.value.slice(piece.start, piece.end), options), piece.start);

const collectPieceEdits = (piece: DetailsPiece, valueEdits: SourceEdit[], ctx: CollectContext): void => {
    const map = valueOffsetMap(ctx.source, piece.node, piece.node.value);
    if (map === null) return;
    ctx.edits.push(...mapEdits(valueEdits, map));
};

const collectDetails = (element: DetailsElement, ctx: CollectContext): void => {
    if (element.summary) {
        collectPieceEdits(element.summary, cleanedPieceEdits(element.summary, ctx.options), ctx);
    }
    for (const fragment of element.fragments) {
        collectPieceEdits(fragment, cleanedPieceEdits(fragment, ctx.options), ctx);
    }
    for (const block of element.blocks) collectBlock(block, ctx);
    if (element.trailing) {
        collectPieceEdits(element.trailing, rawPieceEdits(element.trailing, ctx.options), ctx);
    }
};

const collectSiblings = (nodes: readonly RootContent[], ctx: CollectContext): void => {
    let index = 0;
    while (index < nodes.length) {
        const element = scanDetailsElement(nodes, index);
        if (element) {
            collectDetails(element, ctx);
            index = element.nextIndex;
            continue;
        }
        const node = nodes[index];
        if (node !== undefined) collectBlock(node, ctx);
        index += 1;
    }
};

/** All edits for a complete source, relative to it */
export const collectRichEdits = (
    source: string,
    options: RewriteOptions,
    synthetic: SyntheticRange | null
): SourceEdit[] => {
    const root = parseSource(source, options);
    const ctx: CollectContext = { source, options, edits: [] };
    collectSiblings(root.children, ctx);
    if (synthetic) ctx.edits.push(...unpairedSyntheticEdits(root, synthetic));
    return ctx.edits;
};
