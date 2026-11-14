/**
 * Walk the package's own parse of a markdown source and collect the edits
 * that make Telegram's rich parser read it the same way. The walk mirrors
 * the renderer's (render/walker.ts): same parser and options, same
 * <details> handling (pieces inside html are cleaned and re-parsed as
 * markdown), same per-leaf-block html tag pairing. Code, math, tables,
 * links and escapes produce no edits.
 */
import type { Html, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast';
import { match } from 'ts-pattern';
import { cleanDetailsFragmentWithOffsets } from '../../render/details';
import { parseMarkdown } from '../../render/parse';
import type { SpoilerMode } from '../../render/spoiler/micromark-spoiler';
import { isUnderscoreStrong } from '../../render/strong-delimiter';
import { scanDetailsElement, type DetailsElement, type DetailsPiece } from './details-scan';
import { leafMath, NO_MATH, touchesFormula, type LeafMath } from './display-math';
import type { SourceSpan } from './dollar-runs';
import { htmlValueEdits, type SpoilerSpanState } from './html-edits';
import { loneDollarEdits } from './lone-dollars';
import { softBreakEdits } from './soft-breaks';
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

/** What the inline content of one leaf block (paragraph, heading, cell) shares */
interface LeafScope {
    /** Spoiler-span pairing: the renderer flushes open tags at every block end */
    spans: SpoilerSpanState;
    /** Its '$$' formulas, which no edit may touch */
    math: LeafMath;
}

const pushOutsideFormulas = (edits: readonly SourceEdit[], scope: LeafScope, ctx: CollectContext): void => {
    for (const edit of edits) {
        if (!touchesFormula(scope.math, edit)) ctx.edits.push(edit);
    }
};

/**
 * Replace a delimiter-wrapped node's delimiters, keeping its content. The
 * opening delimiter is the run of the node's first character, up to its
 * first child; the closing one the run of its last character, back to its
 * last child (a line's indentation between the two stays). Works for any
 * delimiter length.
 */
const wrapDelimiters = (
    node: Parent,
    open: string,
    close: string,
    scope: LeafScope,
    ctx: CollectContext
): void => {
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

    const opening = { start, end: openEnd, text: open };
    const closing = { start: closeStart, end, text: close };
    // A pair with a delimiter inside a formula is left alone as a whole
    if (touchesFormula(scope.math, opening) || touchesFormula(scope.math, closing)) return;
    ctx.edits.push(opening, closing);
};

const collectHtml = (node: Html, isBlock: boolean, scope: LeafScope, ctx: CollectContext): void => {
    const map = valueOffsetMap(ctx.source, node, node.value);
    if (map === null) return;
    const edits = mapEdits(htmlValueEdits(node.value, isBlock, scope.spans), map, node.value, ctx.source);
    pushOutsideFormulas(edits, scope, ctx);
};

/** Literal text: soft line breaks become hard ones, lone '$' are escaped */
const collectText = (node: Text, scope: LeafScope, ctx: CollectContext): void => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    const edits = [
        ...softBreakEdits(ctx.source, start, end, scope.math.untouchedNewlines),
        ...loneDollarEdits(ctx.source, start, end),
    ];
    pushOutsideFormulas(edits, scope, ctx);
};

const collectPhrasing = (
    nodes: readonly PhrasingContent[],
    scope: LeafScope,
    ctx: CollectContext
): void => {
    for (const node of nodes) {
        match(node)
            .with({ type: 'strong' }, (strong) => {
                const underline = ctx.options.underline && isUnderscoreStrong(strong, ctx.source);
                wrapDelimiters(strong, underline ? '<u>' : '<b>', underline ? '</u>' : '</b>', scope, ctx);
                collectPhrasing(strong.children, scope, ctx);
            })
            .with({ type: 'emphasis' }, (emphasis) => {
                wrapDelimiters(emphasis, '<i>', '</i>', scope, ctx);
                collectPhrasing(emphasis.children, scope, ctx);
            })
            .with({ type: 'delete' }, (deleted) => {
                wrapDelimiters(deleted, '<s>', '</s>', scope, ctx);
                collectPhrasing(deleted.children, scope, ctx);
            })
            .with({ type: 'spoiler' }, (spoiler) => {
                wrapDelimiters(spoiler, '<tg-spoiler>', '</tg-spoiler>', scope, ctx);
                collectPhrasing(spoiler.children, scope, ctx);
            })
            .with({ type: 'link' }, { type: 'linkReference' }, (link) =>
                collectPhrasing(link.children, scope, ctx)
            )
            .with({ type: 'html' }, (html) => collectHtml(html, false, scope, ctx))
            .with({ type: 'text' }, (text) => collectText(text, scope, ctx))
            .otherwise(() => undefined);
    }
};

/** Source ranges of the inline code under nodes: '$$' there is code, not math */
const codeSpansOf = (nodes: readonly PhrasingContent[], found: SourceSpan[] = []): SourceSpan[] => {
    for (const node of nodes) {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        if (node.type === 'inlineCode' && start !== undefined && end !== undefined) found.push({ start, end });
        if ('children' in node) codeSpansOf(node.children, found);
    }
    return found;
};

/** The shared scope of a leaf block's inline content */
const leafScope = (leaf: Parent & { children: PhrasingContent[] }, ctx: CollectContext): LeafScope => {
    const start = leaf.position?.start.offset;
    const end = leaf.position?.end.offset;
    const math =
        start === undefined || end === undefined ? NO_MATH : leafMath(ctx.source, start, end, codeSpansOf(leaf.children));
    return { spans: { open: 0 }, math };
};

const collectLeaf = (leaf: Parent & { children: PhrasingContent[] }, ctx: CollectContext): void =>
    collectPhrasing(leaf.children, leafScope(leaf, ctx), ctx);

const collectBlock = (node: RootContent, ctx: CollectContext): void => {
    match(node)
        .with({ type: 'paragraph' }, { type: 'heading' }, (leaf) => collectLeaf(leaf, ctx))
        .with({ type: 'table' }, (table) => {
            for (const row of table.children) {
                for (const cell of row.children) collectLeaf(cell, ctx);
            }
        })
        .with({ type: 'html' }, (html) => collectHtml(html, true, { spans: { open: 0 }, math: NO_MATH }, ctx))
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
    return shiftEdits(mapEdits(editsForMarkdown(cleaned.text, options), toRaw, cleaned.text, raw), piece.start);
};

/** A piece the walker re-parses as it is (the markdown trailing </details>) */
const rawPieceEdits = (piece: DetailsPiece, options: RewriteOptions): SourceEdit[] =>
    shiftEdits(editsForMarkdown(piece.node.value.slice(piece.start, piece.end), options), piece.start);

const collectPieceEdits = (piece: DetailsPiece, valueEdits: SourceEdit[], ctx: CollectContext): void => {
    const map = valueOffsetMap(ctx.source, piece.node, piece.node.value);
    if (map === null) return;
    ctx.edits.push(...mapEdits(valueEdits, map, piece.node.value, ctx.source));
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
