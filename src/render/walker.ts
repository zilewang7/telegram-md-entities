/**
 * mdast → emitter walker: maps markdown AST nodes onto plain text + entity
 * open/close calls. Lenient by design — unknown nodes degrade to their text
 * content, never throw.
 */
import type {
    Blockquote,
    Heading,
    Image,
    Link,
    List,
    Node,
    PhrasingContent,
    RootContent,
    Strong,
    Table,
} from 'mdast';
import { match } from 'ts-pattern';
import type { EntitySpec, Emitter } from './emitter';
import {
    cleanDetailsFragment,
    extractLeadingSummary,
    scanForDetailsClose,
    stripDetailsOpenTag,
} from './details';
import { flushHtmlStack, renderHtmlValue, type HtmlTagFrame } from './html-tags';
import { resolveLinkTarget } from './link-target';
import { parseMarkdown } from './parse';
import { alignedTableText, plainTableText, tableToCells } from './table';
import { tableHasWideContent, tableToRecordLines } from './table-records';
import { plainTextOfNodes } from './plain-text';

export interface WalkOptions {
    streaming: boolean;
    table: 'auto' | 'pre' | 'records' | 'plain';
    heading: 'bold' | 'bold-underline';
    hrText: string;
    underline: boolean;
    spoiler: boolean;
    spoilerMode: 'loose' | 'strict';
    linkifyBareUrls: boolean;
}

export interface WalkContext {
    emitter: Emitter;
    options: WalkOptions;
    /** The parsed source, for details mdast drops (e.g. emphasis delimiter) */
    source: string;
    /** >0 when inside a blockquote (blockquotes cannot nest in Telegram) */
    quoteDepth: number;
    /** nesting depth for list indentation */
    listDepth: number;
    /** open HTML formatting tags (<b>…) awaiting their close tag */
    htmlStack: HtmlTagFrame[];
}

type BlockGap = '\n' | '\n\n';

const wrapEntity = (ctx: WalkContext, spec: EntitySpec, body: () => void): void => {
    const handle = ctx.emitter.openEntity(spec);
    body();
    ctx.emitter.closeEntity(handle);
};

const renderLink = (node: Link, ctx: WalkContext): void => {
    const label = plainTextOfNodes(node.children);
    const isBareAutolink =
        node.url === label ||
        node.url === `http://${label}` ||
        node.url === `https://${label}` ||
        node.url === `mailto:${label}`;

    if (isBareAutolink && !ctx.options.linkifyBareUrls) {
        // Clients auto-link plain URLs; a text_link would only add noise
        walkInlineChildren(node.children, ctx);
        return;
    }

    const target = resolveLinkTarget(node.url);
    if (target === null) {
        // Relative/invalid URL: Telegram would reject the entity — keep info as text
        walkInlineChildren(node.children, ctx);
        if (node.url && node.url !== label) {
            ctx.emitter.pushText(` (${node.url})`);
        }
        return;
    }

    wrapEntity(ctx, { type: 'text_link', url: target }, () =>
        walkInlineChildren(node.children, ctx)
    );
};

const renderImage = (node: Image, ctx: WalkContext): void => {
    const label = node.alt || node.url;
    const target = resolveLinkTarget(node.url);
    if (target === null) {
        ctx.emitter.pushText(label);
        return;
    }
    wrapEntity(ctx, { type: 'text_link', url: target }, () => ctx.emitter.pushText(label));
};

const renderHeading = (node: Heading, ctx: WalkContext): void => {
    const bold = ctx.emitter.openEntity({ type: 'bold' });
    const underline =
        ctx.options.heading === 'bold-underline' && node.depth <= 2
            ? ctx.emitter.openEntity({ type: 'underline' })
            : null;
    walkInlineChildren(node.children, ctx);
    if (underline) ctx.emitter.closeEntity(underline);
    ctx.emitter.closeEntity(bold);
};

const renderBlockquote = (node: Blockquote, ctx: WalkContext): void => {
    const inner: WalkContext = { ...ctx, quoteDepth: ctx.quoteDepth + 1 };
    if (ctx.quoteDepth > 0) {
        // Telegram blockquotes cannot nest: flatten into the outer quote
        walkBlocks(node.children, inner, '\n\n');
        return;
    }
    wrapEntity(ctx, { type: 'blockquote' }, () => walkBlocks(node.children, inner, '\n\n'));
};

const renderList = (node: List, ctx: WalkContext): void => {
    const start = node.start ?? 1;
    const indent = '    '.repeat(ctx.listDepth);
    const inner: WalkContext = { ...ctx, listDepth: ctx.listDepth + 1 };

    node.children.forEach((item, index) => {
        if (index > 0) ctx.emitter.pushGap('\n');
        const marker = node.ordered ? `${start + index}. ` : '• ';
        // ✅/⬜ (not ☑/☐): U+2611 gets emoji presentation on most clients
        // while U+2610 stays a thin text glyph — a mixed-style ragged list.
        // These two are both forced-emoji, same square shape, same width.
        const checkbox = item.checked === true ? '✅ ' : item.checked === false ? '⬜ ' : '';
        ctx.emitter.pushText(indent + marker + checkbox);
        walkBlocks(item.children, inner, '\n');
    });
};

const renderTableGrid = (node: Table, ctx: WalkContext): void => {
    wrapEntity(ctx, { type: 'pre' }, () => ctx.emitter.pushText(alignedTableText(node)));
};

const renderTableRecords = (node: Table, ctx: WalkContext): void => {
    // Cell-internal line breaks (<br>) survive; continuation lines indent
    // under their bullet so the record structure stays readable
    tableToRecordLines(tableToCells(node)).forEach((line, index) => {
        if (index > 0) ctx.emitter.pushGap('\n');
        ctx.emitter.pushText('• ');
        if (line.key !== '') {
            wrapEntity(ctx, { type: 'bold' }, () =>
                ctx.emitter.pushText(line.key.replace(/\n/g, '\n  '))
            );
            for (const field of line.fields) {
                ctx.emitter.pushText(`\n    • ${field.replace(/\n/g, '\n      ')}`);
            }
        } else {
            // Degenerate row without a first cell: keep fields on one line
            ctx.emitter.pushText(line.fields.join(' · ').replace(/\n/g, '\n  '));
        }
    });
};

const renderTable = (node: Table, ctx: WalkContext): void => {
    match(ctx.options.table)
        .with('plain', () => ctx.emitter.pushText(plainTableText(node)))
        .with('pre', () => renderTableGrid(node, ctx))
        .with('records', () => renderTableRecords(node, ctx))
        .with('auto', () => {
            // Grid alignment is only reliable when the mono font covers every
            // char; wide (CJK/fullwidth) content falls back to record lines
            if (tableHasWideContent(tableToCells(node))) renderTableRecords(node, ctx);
            else renderTableGrid(node, ctx);
        })
        .exhaustive();
};

/** Last-resort handling so unknown node types never throw or vanish silently */
const renderUnknown = (node: Node, ctx: WalkContext): void => {
    const text = plainTextOfNodes([node]);
    if (text) ctx.emitter.pushText(text);
};

/**
 * Telegram MarkdownV2 dialect: '__text__' means underline, '**text**' bold.
 * mdast strong doesn't record its delimiter, so read it back off the source.
 */
const strongEntityType = (node: Strong, ctx: WalkContext): 'bold' | 'underline' => {
    if (!ctx.options.underline) return 'bold';
    const offset = node.position?.start.offset;
    return offset !== undefined && ctx.source[offset] === '_' ? 'underline' : 'bold';
};

const walkInlineChildren = (nodes: PhrasingContent[], ctx: WalkContext): void => {
    for (const node of nodes) walkInline(node, ctx);
};

const walkInline = (node: PhrasingContent, ctx: WalkContext): void => {
    match(node)
        .with({ type: 'text' }, (n) => ctx.emitter.pushText(n.value))
        .with({ type: 'strong' }, (n) =>
            wrapEntity(ctx, { type: strongEntityType(n, ctx) }, () =>
                walkInlineChildren(n.children, ctx)
            )
        )
        .with({ type: 'emphasis' }, (n) =>
            wrapEntity(ctx, { type: 'italic' }, () => walkInlineChildren(n.children, ctx))
        )
        .with({ type: 'delete' }, (n) =>
            wrapEntity(ctx, { type: 'strikethrough' }, () => walkInlineChildren(n.children, ctx))
        )
        .with({ type: 'inlineCode' }, (n) =>
            wrapEntity(ctx, { type: 'code' }, () => ctx.emitter.pushText(n.value))
        )
        .with({ type: 'spoiler' }, (n) =>
            wrapEntity(ctx, { type: 'spoiler' }, () => walkInlineChildren(n.children, ctx))
        )
        .with({ type: 'link' }, (n) => renderLink(n, ctx))
        .with({ type: 'image' }, (n) => renderImage(n, ctx))
        .with({ type: 'break' }, () => ctx.emitter.pushText('\n'))
        .with({ type: 'html' }, (n) => renderHtmlValue(n.value, ctx.emitter, ctx.htmlStack))
        .with({ type: 'footnoteReference' }, (n) => ctx.emitter.pushText(`[${n.identifier}]`))
        .with({ type: 'linkReference' }, (n) => walkInlineChildren(n.children, ctx))
        .with({ type: 'imageReference' }, (n) => ctx.emitter.pushText(n.alt ?? ''))
        .otherwise((n) => renderUnknown(n, ctx));
};

const walkBlock = (node: RootContent, ctx: WalkContext): void => {
    renderBlockNode(node, ctx);
    // HTML formatting cannot span blocks: whatever is still open closes
    // here, so an unclosed <b> styles at most the rest of its own block
    flushHtmlStack(ctx.emitter, ctx.htmlStack);
};

const renderBlockNode = (node: RootContent, ctx: WalkContext): void => {
    match(node)
        .with({ type: 'paragraph' }, (n) => walkInlineChildren(n.children, ctx))
        .with({ type: 'heading' }, (n) => renderHeading(n, ctx))
        .with({ type: 'code' }, (n) =>
            wrapEntity(
                ctx,
                { type: 'pre', ...(n.lang ? { language: n.lang } : {}) },
                () => ctx.emitter.pushText(n.value)
            )
        )
        .with({ type: 'blockquote' }, (n) => renderBlockquote(n, ctx))
        .with({ type: 'list' }, (n) => renderList(n, ctx))
        .with({ type: 'table' }, (n) => renderTable(n, ctx))
        .with({ type: 'thematicBreak' }, () => ctx.emitter.pushText(ctx.options.hrText))
        .with({ type: 'html' }, (n) => renderHtmlValue(n.value, ctx.emitter, ctx.htmlStack))
        .with({ type: 'footnoteDefinition' }, (n) => {
            ctx.emitter.pushText(`[${n.identifier}]: `);
            walkBlocks(n.children, ctx, '\n');
        })
        .with({ type: 'definition' }, () => {
            // reference-link definitions carry no visible content
        })
        .otherwise((n) => renderUnknown(n, ctx));
};

type DetailsPart =
    | { kind: 'fragment'; markdown: string }
    | { kind: 'block'; node: RootContent };

interface DetailsScan {
    /** Inner markdown of <summary> — the bold header line — or null */
    summary: string | null;
    /** Element content, in order: raw html-block slices & regular mdast blocks */
    parts: DetailsPart[];
    /** Markdown after </details> that shared the closing html block */
    trailing: string;
    /** No </details> found (streaming buffer or malformed document) */
    unclosed: boolean;
    /** Sibling index right after the element */
    nextIndex: number;
}

/**
 * Recognize a <details> element starting at nodes[index]. Contiguous lines
 * share the opening html block; blank-line-separated markdown inside parses
 * as regular sibling blocks, so scan forward until the html block carrying
 * the matching </details> (nested elements tracked by depth).
 */
const scanDetails = (nodes: RootContent[], index: number): DetailsScan | null => {
    const opening = nodes[index];
    if (opening === undefined || opening.type !== 'html') return null;
    const afterOpen = stripDetailsOpenTag(opening.value);
    if (afterOpen === null) return null;

    const parts: DetailsPart[] = [];
    let summary: string | null = null;
    const pushFragment = (markdown: string): void => {
        if (markdown.trim() !== '') parts.push({ kind: 'fragment', markdown });
    };
    const takeSummary = (raw: string): string => {
        const extracted = extractLeadingSummary(raw);
        if (extracted === null) return raw;
        summary = extracted.summary;
        return extracted.rest;
    };

    const body = takeSummary(afterOpen);
    const bodyScan = scanForDetailsClose(body, 0);
    if (bodyScan.closed) {
        pushFragment(bodyScan.inside);
        return { summary, parts, trailing: bodyScan.after, unclosed: false, nextIndex: index + 1 };
    }
    pushFragment(body);
    let depth = bodyScan.depth;

    let nextIndex = index + 1;
    while (nextIndex < nodes.length) {
        const node = nodes[nextIndex];
        if (node === undefined) break;
        if (node.type !== 'html') {
            parts.push({ kind: 'block', node });
            nextIndex += 1;
            continue;
        }
        // A blank line may separate <summary> from <details>: it then arrives
        // as the first content-bearing sibling instead of the opening block
        const value = summary === null && parts.length === 0 ? takeSummary(node.value) : node.value;
        const siblingScan = scanForDetailsClose(value, depth);
        if (siblingScan.closed) {
            pushFragment(siblingScan.inside);
            return {
                summary,
                parts,
                trailing: siblingScan.after,
                unclosed: false,
                nextIndex: nextIndex + 1,
            };
        }
        pushFragment(value);
        depth = siblingScan.depth;
        nextIndex += 1;
    }
    return { summary, parts, trailing: '', unclosed: true, nextIndex };
};

/** Parse a raw slice as standalone markdown and emit it in place */
const renderRawFragment = (markdown: string, ctx: WalkContext, gap: BlockGap): void => {
    if (markdown === '') return;
    const root = parseMarkdown(markdown, { spoiler: ctx.options.spoiler, spoilerMode: ctx.options.spoilerMode });
    // Positions in the re-parsed tree refer to the fragment string
    walkBlocks(root.children, { ...ctx, source: markdown }, gap);
};

const renderDetails = (scan: DetailsScan, ctx: WalkContext): void => {
    // A trailing half-typed tag only exists while the stream is still inside
    // the element; complete documents are never touched (streaming === strict)
    const dropPartialTag = ctx.options.streaming && scan.unclosed;
    const summary = cleanDetailsFragment(
        scan.summary ?? '',
        dropPartialTag && scan.parts.length === 0
    );
    const fragmentAt = (part: DetailsPart, index: number): string =>
        part.kind === 'fragment'
            ? cleanDetailsFragment(part.markdown, dropPartialTag && index === scan.parts.length - 1)
            : '';

    const inner: WalkContext = { ...ctx, quoteDepth: ctx.quoteDepth + 1 };
    const renderBody = (): void => {
        if (summary !== '') {
            wrapEntity(ctx, { type: 'bold' }, () => renderRawFragment(summary, inner, '\n'));
            // Clients collapse expandable quotes to their first ~3 visible
            // lines — pad below the summary so the content starts under the
            // fold and stays hidden until expanded (lazy gap: no padding
            // when nothing follows). Pointless when flattened into an
            // enclosing quote, which cannot collapse.
            ctx.emitter.pushGap(ctx.quoteDepth > 0 ? '\n' : '\n\n\n');
        }
        scan.parts.forEach((part, index) => {
            if (part.kind === 'block') {
                walkBlock(part.node, inner);
            } else {
                const markdown = fragmentAt(part, index);
                // A slice may clean away entirely (e.g. a lone <br> line):
                // it must not leave a block gap behind
                if (markdown === '') return;
                renderRawFragment(markdown, inner, '\n\n');
            }
            ctx.emitter.pushGap('\n\n');
        });
    };

    if (ctx.quoteDepth > 0) {
        // Telegram quotes cannot nest: flatten into the enclosing quote
        renderBody();
        return;
    }
    wrapEntity(ctx, { type: 'expandable_blockquote' }, renderBody);
};

export const walkBlocks = (nodes: RootContent[], ctx: WalkContext, gap: BlockGap): void => {
    let index = 0;
    while (index < nodes.length) {
        const details = scanDetails(nodes, index);
        if (details) {
            renderDetails(details, ctx);
            index = details.nextIndex;
            if (details.trailing.trim() !== '') {
                ctx.emitter.pushGap(gap);
                renderRawFragment(details.trailing, ctx, gap);
            }
        } else {
            const node = nodes[index];
            if (node !== undefined) walkBlock(node, ctx);
            index += 1;
        }
        ctx.emitter.pushGap(gap);
    }
};
