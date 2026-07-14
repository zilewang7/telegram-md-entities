/**
 * { text, entities } → HTML approximating Telegram's rendering. Pure and
 * offline: snapshot tests and the playground use it to eyeball output
 * without touching the Bot API.
 */
import { match } from 'ts-pattern';
import type { MessageEntity, PreviewOptions, RenderedMessage } from '../types';
import { buildEntityTree, type EntityNode } from './entity-tree';
import { TELEGRAM_PREVIEW_CSS } from './styles';

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const wrapTag = (entity: MessageEntity, inner: string): string =>
    match(entity.type)
        .with('bold', () => `<strong>${inner}</strong>`)
        .with('italic', () => `<em>${inner}</em>`)
        .with('underline', () => `<u>${inner}</u>`)
        .with('strikethrough', () => `<s>${inner}</s>`)
        .with('spoiler', () => `<span class="tg-spoiler">${inner}</span>`)
        .with('code', () => `<code>${inner}</code>`)
        .with('pre', () => {
            const header = entity.language
                ? `<div class="tg-pre-header">${escapeHtml(entity.language)}</div>`
                : '';
            const codeClass = entity.language
                ? ` class="language-${escapeHtml(entity.language)}"`
                : '';
            return `<pre>${header}<code${codeClass}>${inner}</code></pre>`;
        })
        .with(
            'text_link',
            () => `<a href="${escapeHtml(entity.url ?? '')}" target="_blank">${inner}</a>`
        )
        .with('blockquote', () => `<blockquote>${inner}</blockquote>`)
        .with(
            'expandable_blockquote',
            () => `<blockquote class="tg-expandable">${inner}</blockquote>`
        )
        .exhaustive();

/** Render [start, end) of text, weaving in the entity nodes covering it */
const renderSpan = (
    text: string,
    start: number,
    end: number,
    nodes: EntityNode[]
): string => {
    let html = '';
    let cursor = start;

    for (const node of nodes) {
        const { offset, length } = node.entity;
        if (offset >= end) break;
        if (offset > cursor) {
            html += escapeHtml(text.slice(cursor, offset));
        }
        const nodeEnd = Math.min(offset + length, end);
        html += wrapTag(node.entity, renderSpan(text, offset, nodeEnd, node.children));
        cursor = nodeEnd;
    }

    if (cursor < end) {
        html += escapeHtml(text.slice(cursor, end));
    }
    return html;
};

export const toPreviewHtml = (
    message: RenderedMessage,
    options?: PreviewOptions
): string => {
    const includeStyles = options?.includeStyles ?? true;
    const tree = buildEntityTree(message.entities);
    // Block-level wrappers (pre/blockquote) bring their own spacing; swallow
    // one adjacent separator newline so pre-wrap doesn't double the gap
    const body = renderSpan(message.text, 0, message.text.length, tree)
        .replace(/\n(<(?:pre|blockquote)\b)/g, '$1')
        .replace(/(<\/(?:pre|blockquote)>)\n/g, '$1');
    const messageHtml = `<div class="tg-message">${body}</div>`;
    return includeStyles
        ? `<style>${TELEGRAM_PREVIEW_CSS}</style>\n${messageHtml}`
        : messageHtml;
};
