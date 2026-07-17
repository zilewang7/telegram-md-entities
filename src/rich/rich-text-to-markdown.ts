/**
 * RichText tree → inline markdown in this package's own input dialect.
 * The tree is already properly nested (unlike flat Bot API entities), so
 * this is a straight recursive walk. Styles already active on the path are
 * not re-wrapped — nested duplicate markers would break the re-parse.
 *
 * (Plain switch instead of ts-pattern here: the recursive RichTextNode
 * union blows past TS's instantiation depth inside match().)
 */
import { escapeMarkdownText, escapeMarkdownUrl, wrapInlineCode } from './escape-markdown';
import type { RichTextNode, RichTextStyled } from './rich-types';

type StyleKey = RichTextStyled['type'];

const STYLE_MARKERS: Partial<Record<StyleKey, string>> = {
    bold: '**',
    italic: '*',
    underline: '__',
    strikethrough: '~~',
    spoiler: '||',
};

interface InlineContext {
    activeStyles: ReadonlySet<StyleKey>;
}

const EMPTY_CONTEXT: InlineContext = { activeStyles: new Set() };

/**
 * Wrap rendered content in a style marker, keeping edge whitespace outside
 * the markers — `** bold **` fails flanking on a strict re-parse, and the
 * server does not style edge whitespace anyway.
 */
const wrapWithMarker = (marker: string, inner: string): string => {
    const parts = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const lead = parts?.[1] ?? '';
    const core = parts?.[2] ?? '';
    const trail = parts?.[3] ?? '';
    if (core.length === 0) return inner;
    return `${lead}${marker}${core}${marker}${trail}`;
};

const renderStyled = (node: RichTextStyled, context: InlineContext): string => {
    const marker = STYLE_MARKERS[node.type];
    if (!marker || context.activeStyles.has(node.type)) {
        // marked/sub/superscript have no dialect syntax; duplicate nested
        // styles render inner content only
        return renderRichText(node.text, context);
    }
    const nextContext: InlineContext = {
        activeStyles: new Set([...context.activeStyles, node.type]),
    };
    return wrapWithMarker(marker, renderRichText(node.text, nextContext));
};

/** Recursively flatten a RichText node to plain text (no markdown) */
export const richTextToPlain = (node: RichTextNode): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(richTextToPlain).join('');
    switch (node.type) {
        case 'custom_emoji':
            return node.alternative_text;
        case 'mathematical_expression':
            return node.expression;
        case 'anchor':
            return '';
        default:
            return richTextToPlain(node.text);
    }
};

export const renderRichText = (
    node: RichTextNode,
    context: InlineContext = EMPTY_CONTEXT
): string => {
    if (typeof node === 'string') return escapeMarkdownText(node);
    if (Array.isArray(node)) {
        return node.map((child) => renderRichText(child, context)).join('');
    }
    switch (node.type) {
        case 'bold':
        case 'italic':
        case 'underline':
        case 'strikethrough':
        case 'spoiler':
        case 'marked':
        case 'subscript':
        case 'superscript':
            return renderStyled(node, context);
        case 'code':
            return wrapInlineCode(richTextToPlain(node.text));
        case 'url': {
            const label = renderRichText(node.text, context);
            return label.trim().length > 0
                ? `[${label}](${escapeMarkdownUrl(node.url)})`
                : label;
        }
        case 'text_mention':
            return `[${renderRichText(node.text, context)}](tg://user?id=${node.user.id})`;
        case 'custom_emoji':
            return escapeMarkdownText(node.alternative_text);
        case 'mathematical_expression':
            return wrapInlineCode(node.expression);
        case 'anchor':
            return '';
        default:
            // mention/hashtag/email/date_time/anchor_link/reference…: text through
            return renderRichText(node.text, context);
    }
};
