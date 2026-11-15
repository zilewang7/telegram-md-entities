/**
 * Read-only collection of the markdown images in a source string, at the
 * offsets the package's own parser reports, so a bot can replace them in
 * place with rich-media blocks (Bot API 10.1+ photo/video blocks or its own
 * media placeholders).
 *
 * This walks the same parse the renderer walks (render/walker.ts): code
 * spans and fenced/indented code hold no images, raw HTML is opaque (an
 * `<img>` tag is not markdown image syntax), reference-style images resolve
 * through their link reference definition, and the body of a `<details>`
 * element is re-parsed as markdown the way renderMarkdown re-parses it.
 * Images are found wherever that parse finds them — inside quotes, lists,
 * tables, links and details — and `block` marks the ones that stand alone
 * in a top-level paragraph, which a rich message replaces as a media block
 * rather than inline content.
 */
import type { Definition, Image, ImageReference, Paragraph, PhrasingContent, Root, RootContent } from 'mdast';
import { match } from 'ts-pattern';
import { cleanDetailsFragmentWithOffsets, type CleanedFragment } from '../render/details';
import { parseMarkdown, type ParseOptions } from '../render/parse';
import { scanDetailsElement, type DetailsElement, type DetailsPiece } from './to-rich-markdown/details-scan';
import type { OffsetMap } from './to-rich-markdown/source-edits';
import { valueOffsetMap } from './to-rich-markdown/value-offsets';

/** One markdown image in the source, as the package's parser reads it */
export interface RichImageRef {
    /** 0-based occurrence index among all image nodes the parser sees */
    index: number;
    /**
     * The destination the parser reads: http(s) URLs, relative refs and
     * bot-internal refs like `g1/img1/s1/#12` are all returned verbatim.
     * Backslash escapes and character references are resolved as the
     * renderer resolves them; a reference-style image gives its definition's
     * url (no definition: the syntax is text, so no ref is reported).
     */
    url: string;
    /** Alt text as the parser reads it (may be '') */
    alt: string;
    /** Markdown title when the image carries one */
    title?: string;
    /** UTF-16 source offsets of the whole image syntax: from the '!' to the closing ')' (exclusive end) */
    start: number;
    end: number;
    /**
     * true only when the image alone forms a top-level paragraph (the node is the
     * only meaningful inline content of a top-level paragraph block); images inside
     * blockquotes, lists, tables, details, links, or inline with text are false.
     */
    block: boolean;
}

/** What one collected image knows before its occurrence index is assigned */
interface ImageSighting {
    url: string;
    alt: string;
    title?: string;
    start: number;
    end: number;
    block: boolean;
}

/** The text one parse ran on, and how its offsets map back into the caller's document */
interface ParseScope {
    /** The text the nodes were parsed from */
    text: string;
    /** The caller's markdown, where every sighting is reported */
    document: string;
    /** Maps an offset in `text` to an offset in `document` */
    toDocument: OffsetMap;
    /** The definition that resolves each reference-style image of this parse */
    definitions: Map<string, Definition>;
    /** Sightings so far, in no particular order (sorted by source offset at the end) */
    images: ImageSighting[];
}

/** Same parse and options as the renderer (and toRichMarkdown's default reading) */
const PARSE_OPTIONS: ParseOptions = { spoiler: true, spoilerMode: 'loose' };

const parseSource = (text: string): Root => parseMarkdown(text, PARSE_OPTIONS);

const isImageNode = (node: PhrasingContent): node is Image | ImageReference =>
    node.type === 'image' || node.type === 'imageReference';

/** The url/alt/title an image renders with; null for a reference no definition resolves */
type ImageInfo = { url: string; alt: string; title?: string };

const withOptionalTitle = (info: { url: string; alt: string }, title: string | null | undefined): ImageInfo => {
    if (title === null || title === undefined) return info;
    return { ...info, title };
};

const imageInfoOf = (image: Image | ImageReference, definitions: Map<string, Definition>): ImageInfo | null => {
    if (image.type === 'image') return withOptionalTitle({ url: image.url, alt: image.alt ?? '' }, image.title);

    const definition = definitions.get(image.identifier);
    if (definition === undefined) return null;
    return withOptionalTitle({ url: definition.url, alt: image.alt ?? '' }, definition.title);
};

/** Link reference definitions of one parse, by normalized identifier (the first one wins) */
const definitionsOf = (nodes: readonly RootContent[]): Map<string, Definition> => {
    const definitions = new Map<string, Definition>();
    const walk = (children: readonly RootContent[]): void => {
        for (const child of children) {
            match(child)
                .with({ type: 'definition' }, (definition) => {
                    if (!definitions.has(definition.identifier)) definitions.set(definition.identifier, definition);
                })
                .with({ type: 'blockquote' }, { type: 'listItem' }, { type: 'footnoteDefinition' }, (container) =>
                    walk(container.children)
                )
                .with({ type: 'list' }, (list) => {
                    for (const item of list.children) walk(item.children);
                })
                .otherwise(() => undefined);
        }
    };
    walk(nodes);
    return definitions;
};

/** The last character of the syntax the parser reported: ')' inline, ']' for a reference */
const closesImageSyntax = (image: Image | ImageReference): string => (image.type === 'image' ? ')' : ']');

/**
 * Record one image node with document offsets. A sighting whose offsets do
 * not land exactly on the syntax in the document is dropped: a replaced
 * range must be the image itself, never a fragment of it.
 */
const offerImage = (image: Image | ImageReference, block: boolean, scope: ParseScope): void => {
    const start = image.position?.start.offset;
    const end = image.position?.end.offset;
    if (start === undefined || end === undefined) return;
    if (scope.text[start] !== '!') return;

    const info = imageInfoOf(image, scope.definitions);
    if (info === null) return;

    const documentStart = scope.toDocument(start);
    const documentEnd = scope.toDocument(end);
    if (documentStart === undefined || documentEnd === undefined) return;
    if (scope.document[documentStart] !== '!') return;
    if (scope.document[documentEnd - 1] !== closesImageSyntax(image)) return;

    const sighting: ImageSighting = { url: info.url, alt: info.alt, start: documentStart, end: documentEnd, block };
    if (info.title !== undefined) sighting.title = info.title;
    scope.images.push(sighting);
};

/** Every phrasing node that can hold an image, mirrored from render/walker.ts */
const collectPhrasing = (
    nodes: readonly PhrasingContent[],
    blockTarget: Image | ImageReference | null,
    scope: ParseScope
): void => {
    for (const node of nodes) {
        match(node)
            .with({ type: 'image' }, (image) => offerImage(image, image === blockTarget, scope))
            .with({ type: 'imageReference' }, (image) => offerImage(image, image === blockTarget, scope))
            .with(
                { type: 'strong' },
                { type: 'emphasis' },
                { type: 'delete' },
                { type: 'spoiler' },
                { type: 'link' },
                { type: 'linkReference' },
                (parent) => collectPhrasing(parent.children, null, scope)
            )
            .otherwise(() => undefined);
    }
};

/** The image a top-level paragraph carries alone, or null (whitespace is not content) */
const onlyImageChild = (paragraph: Paragraph): Image | ImageReference | null => {
    const meaningful = paragraph.children.filter(
        (child) => !(child.type === 'text' && child.value.trim() === '')
    );
    if (meaningful.length !== 1) return null;
    const only = meaningful[0];
    if (only === undefined) return null;
    return isImageNode(only) ? only : null;
};

const collectBlock = (node: RootContent, topLevel: boolean, scope: ParseScope): void => {
    match(node)
        .with({ type: 'paragraph' }, (paragraph) =>
            collectPhrasing(paragraph.children, topLevel ? onlyImageChild(paragraph) : null, scope)
        )
        .with({ type: 'heading' }, (heading) => collectPhrasing(heading.children, null, scope))
        .with({ type: 'table' }, (table) => {
            for (const row of table.children) {
                for (const cell of row.children) collectPhrasing(cell.children, null, scope);
            }
        })
        .with({ type: 'blockquote' }, { type: 'listItem' }, (container) =>
            collectBlocks(container.children, false, scope)
        )
        .with({ type: 'list' }, (list) => {
            for (const item of list.children) collectBlocks(item.children, false, scope);
        })
        .otherwise(() => undefined);
};

/** A sibling list: root, or the blocks of a quote / list item / footnote */
const collectBlocks = (nodes: readonly RootContent[], topLevel: boolean, scope: ParseScope): void => {
    let index = 0;
    while (index < nodes.length) {
        const details = scanDetailsElement(nodes, index);
        if (details !== null) {
            collectDetails(details, scope);
            index = details.nextIndex;
            continue;
        }
        const node = nodes[index];
        if (node !== undefined) collectBlock(node, topLevel, scope);
        index += 1;
    }
};

/** The raw text of a piece of an html node's value */
const rawTextOf = (piece: DetailsPiece): string => piece.node.value.slice(piece.start, piece.end);

/** Map a cleaned fragment's offsets back through the piece into the document */
const fragmentMap = (cleaned: CleanedFragment, piece: DetailsPiece, valueMap: OffsetMap, outer: OffsetMap): OffsetMap => {
    const rawEnd = (cleaned.rawOffsets[cleaned.rawOffsets.length - 1] ?? -1) + 1;
    return (offset) => {
        if (offset < 0 || offset > cleaned.text.length) return undefined;
        const raw = offset < cleaned.rawOffsets.length ? cleaned.rawOffsets[offset] : rawEnd;
        if (raw === undefined) return undefined;
        const source = valueMap(piece.start + raw);
        return source === undefined ? undefined : outer(source);
    };
};

/** Map a raw fragment's (uncleaned) offsets back through the piece into the document */
const rawFragmentMap = (piece: DetailsPiece, valueMap: OffsetMap, outer: OffsetMap): OffsetMap => (offset) => {
    const source = valueMap(piece.start + offset);
    return source === undefined ? undefined : outer(source);
};

/**
 * Collect the images of a piece re-parsed on its own. Definitions resolve
 * within the piece (the walker re-parses the fragment as a standalone
 * document); `toDocument` maps its offsets back to the caller's markdown.
 */
const collectParsedPiece = (text: string, toDocument: OffsetMap, scope: ParseScope): void => {
    const root = parseSource(text);
    const inner: ParseScope = {
        text,
        document: scope.document,
        toDocument,
        definitions: definitionsOf(root.children),
        images: scope.images,
    };
    collectBlocks(root.children, false, inner);
};

/** A fragment the walker cleans (<br> → newline, trimmed) before re-parsing it as markdown */
const collectCleanedFragment = (piece: DetailsPiece, scope: ParseScope): void => {
    const valueMap = valueOffsetMap(scope.text, piece.node, piece.node.value);
    if (valueMap === null) return;
    const cleaned = cleanDetailsFragmentWithOffsets(rawTextOf(piece));
    collectParsedPiece(cleaned.text, fragmentMap(cleaned, piece, valueMap, scope.toDocument), scope);
};

/** A fragment the walker re-parses as it is (the markdown after </details>) */
const collectRawFragment = (piece: DetailsPiece, scope: ParseScope): void => {
    const valueMap = valueOffsetMap(scope.text, piece.node, piece.node.value);
    if (valueMap === null) return;
    const raw = rawTextOf(piece);
    collectParsedPiece(raw, rawFragmentMap(piece, valueMap, scope.toDocument), scope);
};

/** The pieces of a <details> element; the entry point is the walker's renderDetails */
const collectDetails = (details: DetailsElement, scope: ParseScope): void => {
    if (details.summary !== null) collectCleanedFragment(details.summary, scope);
    for (const fragment of details.fragments) collectCleanedFragment(fragment, scope);
    for (const block of details.blocks) collectBlock(block, false, scope);
    if (details.trailing !== null) collectRawFragment(details.trailing, scope);
};

/**
 * Collect every markdown image of `markdown` in source order. Read-only and
 * deterministic: the same input gives the same offsets, and
 * `markdown.slice(ref.start, ref.end)` is exactly the image syntax.
 */
export const collectRichImages = (markdown: string): RichImageRef[] => {
    const root = parseSource(markdown);
    const scope: ParseScope = {
        text: markdown,
        document: markdown,
        toDocument: (offset) => offset,
        definitions: definitionsOf(root.children),
        images: [],
    };
    collectBlocks(root.children, true, scope);

    const ordered = [...scope.images].sort((left, right) => left.start - right.start || left.end - right.end);
    return ordered.map((image, index) => {
        const ref: RichImageRef = {
            index,
            url: image.url,
            alt: image.alt,
            start: image.start,
            end: image.end,
            block: image.block,
        };
        if (image.title !== undefined) ref.title = image.title;
        return ref;
    });
};
