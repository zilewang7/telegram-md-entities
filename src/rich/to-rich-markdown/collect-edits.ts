/**
 * Walk the package's own parse of a markdown source and collect the edits
 * that make Telegram's rich parser read it the same way. The walk mirrors
 * the renderer's (render/walker.ts): same parser and options, same
 * <details> handling (pieces inside html are cleaned and re-parsed as
 * markdown), same per-leaf-block html tag pairing. Code, math, tables,
 * links and escapes produce no edits.
 */
import type { Heading, Html, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast';
import { match } from 'ts-pattern';
import { cleanDetailsFragmentWithOffsets } from '../../render/details';
import { parseMarkdown } from '../../render/parse';
import type { SpoilerMode } from '../../render/spoiler/micromark-spoiler';
import { isUnderscoreStrong } from '../../render/strong-delimiter';
import { scanDetailsElement, type DetailsElement, type DetailsPiece } from './details-scan';
import { leafMath, NO_MATH, touchesFormula, type LeafMath } from './display-math';
import type { SourceSpan } from './dollar-runs';
import { htmlValueEdits, type SpoilerSpanState } from './html-edits';
import { countNoLinkTags, insideNoLinkElement, noLinkElementsNone, type NoLinkElements } from './html-no-link';
import { leafTextOf, runNeighboursOf, type LeafText } from './leaf-text';
import { lineStartHashEdits } from './line-start-hash';
import { loneDollarRewrite, type LoneDollarRewrite } from './lone-dollars';
import { softBreakEdits } from './soft-breaks';
import { breakAfterTextBlock, breakBeforeTextBlock, type FollowingBlock } from './paragraph-join';
import { bodyPieceReading, type PieceReading } from './piece-reading';
import { isPreBlock, preBlankLineEdits } from './pre-blank-lines';
import { mapEdits, shiftEdits, type OffsetMap, type SourceEdit } from './source-edits';
import { textLinkEdits, type TextLinker } from './text-links';
import { unpairedSyntheticEdits, type SyntheticRange } from './unpaired-synthetic';
import { valueOffsetMap } from './value-offsets';

export interface RewriteOptions {
    underline: boolean;
    spoilerMode: SpoilerMode;
    /** The caller's links for literal text, if any */
    textLinks: TextLinker | undefined;
}

interface CollectContext {
    source: string;
    options: RewriteOptions;
    edits: SourceEdit[];
    /**
     * How Telegram reads this source: a piece of a <details> element (re-parsed
     * on its own) may be HTML text, where no markdown escape may go
     */
    reading: PieceReading;
}

/** What the inline content of one leaf block (paragraph, heading, cell) shares */
interface LeafScope {
    /** Spoiler-span pairing: the renderer flushes open tags at every block end */
    spans: SpoilerSpanState;
    /** Its '$$' formulas, which no edit may touch */
    math: LeafMath;
    /** Inline <a>, <code> and <pre> elements open so far: their text gets no link */
    noLink: NoLinkElements;
    /** What a reader sees in the block, for the linker; null without textLinks */
    leafText: LeafText | null;
    /**
     * Where the first line of a paragraph or a setext heading starts; null for
     * an ATX heading or a table cell, where no line of text starts a line
     */
    paragraphStart: number | null;
}

/** No '$' to escape and no formula: HTML text has no math */
const NO_DOLLAR_REWRITE: LoneDollarRewrite = { edits: [], formulas: [] };

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

/** Collect an html node's edits; true when an html block now reads as paragraph text */
const collectHtml = (node: Html, isBlock: boolean, scope: LeafScope, ctx: CollectContext): boolean => {
    const map = valueOffsetMap(ctx.source, node, node.value);
    if (map === null) return false;
    const rewrite = htmlValueEdits(node.value, isBlock, scope.spans, ctx.reading);
    pushOutsideFormulas(mapEdits(rewrite.edits, map, node.value, ctx.source), scope, ctx);
    if (isBlock && isPreBlock(node.value)) ctx.edits.push(...preBlankLineEdits(node.value, map, ctx.source));
    return rewrite.becameText;
};

/** Where a text node sits, as far as its edits care */
interface TextPlacement {
    /** Right after a bare URL: a '\' there would join the URL */
    followsBareUrl: boolean;
    /** Not inside a link: the caller's links may wrap its text */
    linkable: boolean;
}

/** The caller's links for a text node, when it may have any */
const linkEditsOf = (
    node: Text,
    placement: TextPlacement,
    formulas: readonly SourceSpan[],
    scope: LeafScope,
    ctx: CollectContext
): SourceEdit[] => {
    const linker = ctx.options.textLinks;
    if (linker === undefined || !placement.linkable || insideNoLinkElement(scope.noLink)) return [];
    return textLinkEdits({
        source: ctx.source,
        node,
        linker,
        context: runNeighboursOf(scope.leafText, node),
        formulas,
    });
};

/**
 * Literal text: soft line breaks become hard ones, lone '$' are escaped, a
 * '#' starting a line of a paragraph is escaped, and the caller's ranges
 * become links. In HTML text only the line breaks (as <br>) and the links.
 */
const collectText = (node: Text, placement: TextPlacement, scope: LeafScope, ctx: CollectContext): void => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    const within = { start, end };
    const isMarkdown = ctx.reading === 'markdown';
    const dollars = isMarkdown ? loneDollarRewrite(ctx.source, start, end) : NO_DOLLAR_REWRITE;
    const links = linkEditsOf(node, placement, dollars.formulas, scope, ctx);
    const headingHashes =
        scope.paragraphStart === null || !isMarkdown
            ? []
            : lineStartHashEdits(ctx.source, within, scope.paragraphStart, new Set(links.map((link) => link.start)));
    const softBreakPlacement = { followsBareUrl: placement.followsBareUrl, reading: ctx.reading };
    pushOutsideFormulas(
        [
            ...softBreakEdits(ctx.source, within, scope.math.untouchedNewlines, softBreakPlacement),
            ...dollars.edits,
            ...headingHashes,
            ...links,
        ],
        scope,
        ctx
    );
};

/**
 * An autolink ('<https://…>') or a GFM autolink literal (a bare URL): its
 * text is the URL itself, so an escape inserted there ('?$select=' →
 * '?\$select=') would change the link. Only a '[label]' link has text of
 * its own.
 */
const isAutolink = (link: Parent, source: string): boolean => {
    const start = link.position?.start.offset;
    return start !== undefined && source[start] !== '[';
};

/** A GFM autolink literal right before `next`, with at most whitespace between */
const isBareUrlBefore = (previous: PhrasingContent | undefined, next: PhrasingContent, source: string): boolean => {
    if (previous?.type !== 'link' || !isAutolink(previous, source)) return false;
    const start = previous.position?.start.offset;
    const end = previous.position?.end.offset;
    const nextStart = next.position?.start.offset;
    if (start === undefined || end === undefined || nextStart === undefined) return false;
    return source[start] !== '<' && source.slice(end, nextStart).trim() === '';
};

/** `linkable`: false inside a link, whose text must not get links of its own */
const collectPhrasing = (
    nodes: readonly PhrasingContent[],
    linkable: boolean,
    scope: LeafScope,
    ctx: CollectContext
): void => {
    nodes.forEach((node, index) => {
        match(node)
            .with({ type: 'strong' }, (strong) => {
                const underline = ctx.options.underline && isUnderscoreStrong(strong, ctx.source);
                wrapDelimiters(strong, underline ? '<u>' : '<b>', underline ? '</u>' : '</b>', scope, ctx);
                collectPhrasing(strong.children, linkable, scope, ctx);
            })
            .with({ type: 'emphasis' }, (emphasis) => {
                wrapDelimiters(emphasis, '<i>', '</i>', scope, ctx);
                collectPhrasing(emphasis.children, linkable, scope, ctx);
            })
            .with({ type: 'delete' }, (deleted) => {
                wrapDelimiters(deleted, '<s>', '</s>', scope, ctx);
                collectPhrasing(deleted.children, linkable, scope, ctx);
            })
            .with({ type: 'spoiler' }, (spoiler) => {
                wrapDelimiters(spoiler, '<tg-spoiler>', '</tg-spoiler>', scope, ctx);
                collectPhrasing(spoiler.children, linkable, scope, ctx);
            })
            .with({ type: 'link' }, { type: 'linkReference' }, (link) => {
                if (!isAutolink(link, ctx.source)) collectPhrasing(link.children, false, scope, ctx);
            })
            .with({ type: 'html' }, (html) => {
                collectHtml(html, false, scope, ctx);
                countNoLinkTags(html.value, scope.noLink);
            })
            .with({ type: 'text' }, (text) =>
                collectText(
                    text,
                    { followsBareUrl: isBareUrlBefore(nodes[index - 1], text, ctx.source), linkable },
                    scope,
                    ctx
                )
            )
            .otherwise(() => undefined);
    });
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

/**
 * The shared scope of a leaf block's inline content. `textStartsLines`: its
 * lines of text start lines of the source (a paragraph, a setext heading),
 * unlike an ATX heading's or a table cell's.
 */
const leafScope = (
    leaf: Parent & { children: PhrasingContent[] },
    textStartsLines: boolean,
    ctx: CollectContext
): LeafScope => {
    const start = leaf.position?.start.offset;
    const end = leaf.position?.end.offset;
    const math =
        start === undefined || end === undefined ? NO_MATH : leafMath(ctx.source, start, end, codeSpansOf(leaf.children));
    const leafText = ctx.options.textLinks === undefined ? null : leafTextOf(leaf.children);
    const paragraphStart = textStartsLines && start !== undefined ? start : null;
    return { spans: { open: 0 }, math, noLink: noLinkElementsNone(), leafText, paragraphStart };
};

const collectLeaf = (leaf: Parent & { children: PhrasingContent[] }, textStartsLines: boolean, ctx: CollectContext): void =>
    collectPhrasing(leaf.children, true, leafScope(leaf, textStartsLines, ctx), ctx);

/** A setext heading's source runs over its underline's line; an ATX heading is one line */
const isSetextHeading = (heading: Heading, source: string): boolean => {
    const start = heading.position?.start.offset;
    const end = heading.position?.end.offset;
    return start !== undefined && end !== undefined && source.slice(start, end).includes('\n');
};

/** The blocks around one: an escaped html block must not run into them */
interface Surroundings {
    /** The sibling right before it */
    previous: RootContent | undefined;
    /** The block right after it in reading order (after its container's end when it is the last child) */
    following: FollowingBlock | undefined;
}

const NO_SURROUNDINGS: Surroundings = { previous: undefined, following: undefined };

/** A block-level html node */
const collectHtmlBlock = (node: Html, surroundings: Surroundings, ctx: CollectContext): void => {
    const scope: LeafScope = {
        spans: { open: 0 },
        math: NO_MATH,
        noLink: noLinkElementsNone(),
        leafText: null,
        paragraphStart: null,
    };
    const becameText = collectHtml(node, true, scope, ctx);
    if (!becameText) return;
    ctx.edits.push(
        ...breakBeforeTextBlock(surroundings.previous, node, ctx.source),
        ...breakAfterTextBlock(node, surroundings.following, ctx.source)
    );
};

const collectBlock = (node: RootContent, ctx: CollectContext, surroundings: Surroundings = NO_SURROUNDINGS): void => {
    // What follows a container's last block is what follows the container
    const afterContainer = surroundings.following?.node;
    match(node)
        .with({ type: 'paragraph' }, (paragraph) => collectLeaf(paragraph, true, ctx))
        .with({ type: 'heading' }, (heading) => collectLeaf(heading, isSetextHeading(heading, ctx.source), ctx))
        .with({ type: 'table' }, (table) => {
            for (const row of table.children) {
                for (const cell of row.children) collectLeaf(cell, false, ctx);
            }
        })
        .with({ type: 'html' }, (html) => collectHtmlBlock(html, surroundings, ctx))
        .with({ type: 'blockquote' }, { type: 'listItem' }, { type: 'footnoteDefinition' }, (container) =>
            collectSiblings(container.children, ctx, afterContainer)
        )
        .with({ type: 'list' }, (list) => {
            list.children.forEach((item, index) =>
                collectSiblings(item.children, ctx, list.children[index + 1] ?? afterContainer)
            );
        })
        .otherwise(() => undefined);
};

const parseSource = (source: string, options: RewriteOptions): Root =>
    parseMarkdown(source, { spoiler: true, spoilerMode: options.spoilerMode });

/** Collect edits for a piece of a <details> element, parsed on its own (as the walker re-parses) */
const editsForMarkdown = (source: string, options: RewriteOptions, reading: PieceReading): SourceEdit[] => {
    const ctx: CollectContext = { source, options, edits: [], reading };
    collectSiblings(parseSource(source, options).children, ctx);
    return ctx.edits;
};

/** A piece's raw text, as its html node holds it */
const rawTextOf = (piece: DetailsPiece): string => piece.node.value.slice(piece.start, piece.end);

/** A piece the walker cleans (<br> → newline, trimmed) before re-parsing */
const cleanedPieceEdits = (piece: DetailsPiece, options: RewriteOptions, reading: PieceReading): SourceEdit[] => {
    const raw = rawTextOf(piece);
    const cleaned = cleanDetailsFragmentWithOffsets(raw);
    const toRaw: OffsetMap = (offset) => cleaned.rawOffsets[offset];
    return shiftEdits(mapEdits(editsForMarkdown(cleaned.text, options, reading), toRaw, cleaned.text, raw), piece.start);
};

/** A piece the walker re-parses as it is (the markdown trailing </details>) */
const rawPieceEdits = (piece: DetailsPiece, options: RewriteOptions, reading: PieceReading): SourceEdit[] =>
    shiftEdits(editsForMarkdown(rawTextOf(piece), options, reading), piece.start);

const collectPieceEdits = (piece: DetailsPiece, valueEdits: SourceEdit[], ctx: CollectContext): void => {
    const map = valueOffsetMap(ctx.source, piece.node, piece.node.value);
    if (map === null) return;
    ctx.edits.push(...mapEdits(valueEdits, map, piece.node.value, ctx.source));
};

/**
 * A body piece that follows a tag reads by where it starts (piece-reading.ts);
 * one that is a whole html node of its own (after a blank line) starts a
 * line of the body, which is markdown
 */
const fragmentReading = (fragment: DetailsPiece): PieceReading =>
    fragment.start === 0 ? 'markdown' : bodyPieceReading(rawTextOf(fragment));

/**
 * What follows </details>: text on the tag's line is HTML text (Telegram
 * drops it when the tag starts that line), the lines after it are markdown
 */
const trailingEdits = (trailing: DetailsPiece, options: RewriteOptions): SourceEdit[] => {
    const raw = rawTextOf(trailing);
    const lineEnd = raw.indexOf('\n');
    if (bodyPieceReading(raw) === 'markdown') return rawPieceEdits(trailing, options, 'markdown');
    if (lineEnd === -1) return rawPieceEdits(trailing, options, 'html');
    const tagLineEnd = trailing.start + lineEnd;
    return [
        ...rawPieceEdits(trailing, options, 'html').filter((edit) => edit.end <= tagLineEnd),
        ...rawPieceEdits(trailing, options, 'markdown').filter((edit) => edit.start > tagLineEnd),
    ];
};

/** The <summary> is HTML text to Telegram; the rest depends on where it starts */
const collectDetails = (element: DetailsElement, ctx: CollectContext): void => {
    if (element.summary) {
        collectPieceEdits(element.summary, cleanedPieceEdits(element.summary, ctx.options, 'html'), ctx);
    }
    for (const fragment of element.fragments) {
        collectPieceEdits(fragment, cleanedPieceEdits(fragment, ctx.options, fragmentReading(fragment)), ctx);
    }
    for (const block of element.blocks) collectBlock(block, ctx);
    if (element.trailing) collectPieceEdits(element.trailing, trailingEdits(element.trailing, ctx.options), ctx);
};

/** The block after nodes[index] in reading order */
const followingOf = (
    nodes: readonly RootContent[],
    index: number,
    afterContainer: RootContent | undefined
): FollowingBlock | undefined => {
    const next = nodes[index + 1];
    if (next !== undefined) return { node: next, isSibling: true };
    return afterContainer === undefined ? undefined : { node: afterContainer, isSibling: false };
};

/** `afterContainer`: the block after the container these nodes are the children of */
const collectSiblings = (nodes: readonly RootContent[], ctx: CollectContext, afterContainer?: RootContent): void => {
    let index = 0;
    while (index < nodes.length) {
        const element = scanDetailsElement(nodes, index);
        if (element) {
            collectDetails(element, ctx);
            index = element.nextIndex;
            continue;
        }
        const node = nodes[index];
        if (node !== undefined) {
            collectBlock(node, ctx, { previous: nodes[index - 1], following: followingOf(nodes, index, afterContainer) });
        }
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
    const ctx: CollectContext = { source, options, edits: [], reading: 'markdown' };
    collectSiblings(root.children, ctx);
    if (synthetic) ctx.edits.push(...unpairedSyntheticEdits(root, synthetic));
    return ctx.edits;
};
