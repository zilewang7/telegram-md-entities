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
    Table,
} from 'mdast';
import { match } from 'ts-pattern';
import type { EntitySpec, Emitter } from './emitter';
import { alignedTableText, plainTableText } from './table';
import { plainTextOfNodes } from './plain-text';

export interface WalkOptions {
    table: 'pre' | 'plain';
    heading: 'bold' | 'bold-underline';
    hrText: string;
    linkifyBareUrls: boolean;
}

export interface WalkContext {
    emitter: Emitter;
    options: WalkOptions;
    /** >0 when inside a blockquote (blockquotes cannot nest in Telegram) */
    quoteDepth: number;
    /** nesting depth for list indentation */
    listDepth: number;
}

type BlockGap = '\n' | '\n\n';

const wrapEntity = (ctx: WalkContext, spec: EntitySpec, body: () => void): void => {
    const handle = ctx.emitter.openEntity(spec);
    body();
    ctx.emitter.closeEntity(handle);
};

/** Absolute-url policy: scheme → as-is; www. → https:// prefixed; else null */
const resolveLinkTarget = (url: string): string | null => {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return url;
    if (/^www\./i.test(url)) return `https://${url}`;
    return null;
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
        const checkbox = item.checked === true ? '☑ ' : item.checked === false ? '☐ ' : '';
        ctx.emitter.pushText(indent + marker + checkbox);
        walkBlocks(item.children, inner, '\n');
    });
};

const renderTable = (node: Table, ctx: WalkContext): void => {
    if (ctx.options.table === 'plain') {
        ctx.emitter.pushText(plainTableText(node));
        return;
    }
    wrapEntity(ctx, { type: 'pre' }, () => ctx.emitter.pushText(alignedTableText(node)));
};

/** Last-resort handling so unknown node types never throw or vanish silently */
const renderUnknown = (node: Node, ctx: WalkContext): void => {
    const text = plainTextOfNodes([node]);
    if (text) ctx.emitter.pushText(text);
};

const walkInlineChildren = (nodes: PhrasingContent[], ctx: WalkContext): void => {
    for (const node of nodes) walkInline(node, ctx);
};

const walkInline = (node: PhrasingContent, ctx: WalkContext): void => {
    match(node)
        .with({ type: 'text' }, (n) => ctx.emitter.pushText(n.value))
        .with({ type: 'strong' }, (n) =>
            wrapEntity(ctx, { type: 'bold' }, () => walkInlineChildren(n.children, ctx))
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
        .with({ type: 'link' }, (n) => renderLink(n, ctx))
        .with({ type: 'image' }, (n) => renderImage(n, ctx))
        .with({ type: 'break' }, () => ctx.emitter.pushText('\n'))
        .with({ type: 'html' }, (n) => ctx.emitter.pushText(n.value))
        .with({ type: 'footnoteReference' }, (n) => ctx.emitter.pushText(`[${n.identifier}]`))
        .with({ type: 'linkReference' }, (n) => walkInlineChildren(n.children, ctx))
        .with({ type: 'imageReference' }, (n) => ctx.emitter.pushText(n.alt ?? ''))
        .otherwise((n) => renderUnknown(n, ctx));
};

const walkBlock = (node: RootContent, ctx: WalkContext): void => {
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
        .with({ type: 'html' }, (n) => ctx.emitter.pushText(n.value))
        .with({ type: 'footnoteDefinition' }, (n) => {
            ctx.emitter.pushText(`[${n.identifier}]: `);
            walkBlocks(n.children, ctx, '\n');
        })
        .with({ type: 'definition' }, () => {
            // reference-link definitions carry no visible content
        })
        .otherwise((n) => renderUnknown(n, ctx));
};

export const walkBlocks = (nodes: RootContent[], ctx: WalkContext, gap: BlockGap): void => {
    for (const node of nodes) {
        walkBlock(node, ctx);
        ctx.emitter.pushGap(gap);
    }
};
