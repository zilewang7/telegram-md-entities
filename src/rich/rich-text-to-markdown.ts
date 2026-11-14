/**
 * RichText tree → inline markdown in this package's own input dialect.
 * The tree is already properly nested (unlike flat Bot API entities), so
 * this is a straight recursive walk. Styles already active on the path are
 * not re-wrapped — nested duplicate markers would break the re-parse.
 *
 * Lenient on purpose: the server adds inline types over time (10.3 button
 * has no `text`), so a node of an unknown or malformed shape renders its
 * `text` when that is rich text, else nothing — never a TypeError.
 *
 * (Plain switch instead of ts-pattern here: the recursive RichTextNode
 * union blows past TS's instantiation depth inside match().)
 */
import { escapeMarkdownText, escapeMarkdownUrl, wrapInlineCode } from './escape-markdown';
import { isRecord, isRichTextLike } from './rich-guards';
import type { RichMessageButtonNode, RichTextNode, RichTextStyled } from './rich-types';

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

/** The `text` of a node the renderer has no case for, when it is rich text */
const fallbackText = (node: object): RichTextNode | undefined => {
    const text: unknown = 'text' in node ? node.text : undefined;
    return isRichTextLike(text) ? text : undefined;
};

/** A button's label; a malformed button (no object) has none */
const buttonLabel = (button: unknown): RichTextNode =>
    isRecord(button) && isRichTextLike(button.text) ? button.text : '';

const stringOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Recursively flatten a RichText node to plain text (no markdown) */
export const richTextToPlain = (node: RichTextNode): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(richTextToPlain).join('');
    if (!isRecord(node)) return '';
    switch (node.type) {
        case 'custom_emoji':
            return stringOrEmpty(node.alternative_text);
        case 'mathematical_expression':
            return stringOrEmpty(node.expression);
        case 'anchor':
            return '';
        case 'button':
            return richTextToPlain(buttonLabel(node.button));
        default: {
            const text = fallbackText(node);
            return text === undefined ? '' : richTextToPlain(text);
        }
    }
};

/**
 * A button label: a link when the button opens a url, else the label alone
 * (callback, web app, login and copy buttons are bot internals).
 */
export const renderButtonLabel = (
    button: RichMessageButtonNode,
    context: InlineContext = EMPTY_CONTEXT
): string => {
    const label = renderRichText(buttonLabel(button), context);
    const url = isRecord(button) ? button.url : undefined;
    return typeof url === 'string' && label.trim().length > 0
        ? `[${label}](${escapeMarkdownUrl(url)})`
        : label;
};

const renderTextMention = (
    node: { text: RichTextNode; user: { id: number } },
    context: InlineContext
): string => {
    const label = renderRichText(node.text, context);
    const userId: unknown = isRecord(node.user) ? node.user.id : undefined;
    return typeof userId === 'number' ? `[${label}](tg://user?id=${userId})` : label;
};

export const renderRichText = (
    node: RichTextNode,
    context: InlineContext = EMPTY_CONTEXT
): string => {
    if (typeof node === 'string') return escapeMarkdownText(node);
    if (Array.isArray(node)) {
        return node.map((child) => renderRichText(child, context)).join('');
    }
    if (!isRecord(node)) return '';
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
            return typeof node.url === 'string' && label.trim().length > 0
                ? `[${label}](${escapeMarkdownUrl(node.url)})`
                : label;
        }
        case 'text_mention':
            return renderTextMention(node, context);
        case 'custom_emoji':
            return escapeMarkdownText(stringOrEmpty(node.alternative_text));
        case 'mathematical_expression':
            return wrapInlineCode(stringOrEmpty(node.expression));
        case 'anchor':
            return '';
        case 'button':
            return renderButtonLabel(node.button, context);
        default: {
            // mention/hashtag/email/date_time/ton_address/reference…, and any
            // type a later Bot API adds: the text passes through
            const text = fallbackText(node);
            return text === undefined ? '' : renderRichText(text, context);
        }
    }
};

/**
 * Convert a RichText value (a paragraph's text, a quote's text, Bot API
 * 10.4 TextQuote.rich_texts entries…) to inline markdown in this package's
 * input dialect. renderMarkdown of the result shows the same text and
 * styles. Never throws, whatever the input shape.
 */
export const richTextToMarkdown = (richText: RichTextNode): string => renderRichText(richText);
