/**
 * A rendered { text, entities } message → HTML blocks for a rich message.
 *
 * For sections a bot builds itself (a thinking quote, tool records,
 * footers, status lines): they already exist as exact entities, and
 * converting entities to HTML is lossless with only '& < >' to escape,
 * where going back through markdown would reintroduce every escaping edge
 * case. The output embeds in a rich markdown document: every block starts
 * with a block tag at a line start and only <pre> may contain a blank
 * line, so each block is one HTML block to a CommonMark-style parser.
 */
import type { MessageEntity, RenderedMessage } from '../../types';
import { escapeHtmlAttribute, escapeHtmlText } from './escape-html';
import { renderInlineHtml } from './inline-html';

const BLOCK_TYPES = new Set(['blockquote', 'expandable_blockquote', 'pre']);

/** Entities clamped to the text; empty ones dropped */
const clampEntities = (text: string, entities: readonly MessageEntity[]): MessageEntity[] =>
    entities.flatMap((entity) => {
        const start = Math.max(0, entity.offset);
        const end = Math.min(text.length, entity.offset + entity.length);
        return end > start ? [{ ...entity, offset: start, length: end - start }] : [];
    });

/** Entities clipped to [start, end), offsets relative to start */
const clipEntities = (entities: readonly MessageEntity[], start: number, end: number): MessageEntity[] =>
    entities.flatMap((entity) => {
        const clippedStart = Math.max(entity.offset, start);
        const clippedEnd = Math.min(entity.offset + entity.length, end);
        return clippedEnd > clippedStart
            ? [{ ...entity, offset: clippedStart - start, length: clippedEnd - clippedStart }]
            : [];
    });

/** Outermost block entities, in order; nested ones render inline */
const topLevelBlocks = (entities: readonly MessageEntity[]): MessageEntity[] => {
    const blocks = entities
        .filter((entity) => BLOCK_TYPES.has(entity.type))
        .sort((left, right) => left.offset - right.offset || right.length - left.length);
    const topLevel: MessageEntity[] = [];
    for (const block of blocks) {
        const last = topLevel[topLevel.length - 1];
        if (last && block.offset < last.offset + last.length) continue;
        topLevel.push(block);
    }
    return topLevel;
};

/** Text between block entities: one <p> per blank-line-separated paragraph */
const renderParagraphs = (text: string, entities: readonly MessageEntity[], start: number, end: number): string[] => {
    const paragraphs: string[] = [];
    const paragraphBreak = /\n[ \t]*\n\s*/g;
    paragraphBreak.lastIndex = start;
    let cursor = start;
    const pushParagraph = (paragraphEnd: number): void => {
        // Newlines at a block boundary are the boundary itself, not content
        let from = cursor;
        let to = paragraphEnd;
        while (from < to && text[from] === '\n') from += 1;
        while (to > from && text[to - 1] === '\n') to -= 1;
        if (text.slice(from, to).trim() === '') return;
        paragraphs.push(`<p>${renderInlineHtml(text.slice(from, to), clipEntities(entities, from, to))}</p>`);
    };
    let matched = paragraphBreak.exec(text);
    while (matched !== null && matched.index < end) {
        pushParagraph(Math.min(matched.index, end));
        cursor = Math.min(matched.index + matched[0].length, end);
        matched = paragraphBreak.exec(text);
    }
    pushParagraph(end);
    return paragraphs;
};

const renderPre = (text: string, language: string | undefined): string => {
    const content = escapeHtmlText(text);
    return language
        ? `<pre><code class="language-${escapeHtmlAttribute(language)}">${content}</code></pre>`
        : `<pre>${content}</pre>`;
};

const renderBlock = (text: string, entities: readonly MessageEntity[], block: MessageEntity): string => {
    const start = block.offset;
    const end = block.offset + block.length;
    const blockText = text.slice(start, end);
    if (block.type === 'pre') return renderPre(blockText, block.language);
    // Inside a quote: everything else (a nested pre included) renders inline
    const inner = renderInlineHtml(
        blockText,
        clipEntities(entities.filter((entity) => entity !== block), start, end)
    );
    return block.type === 'expandable_blockquote'
        ? `<blockquote expandable>${inner}</blockquote>`
        : `<blockquote>${inner}</blockquote>`;
};

/**
 * Convert a rendered message to rich-message HTML blocks joined by blank
 * lines: blockquote → <blockquote>, expandable_blockquote →
 * <blockquote expandable>, pre → <pre> (with <code class="language-x">),
 * the text between them → <p> paragraphs. Inline entities become
 * b/i/u/s/tg-spoiler/code/a tags; newlines inside a paragraph or quote
 * become <br>. An empty message gives ''.
 */
export const toRichHtml = (message: RenderedMessage): string => {
    const { text } = message;
    const entities = clampEntities(text, message.entities);
    const blocks: string[] = [];
    let cursor = 0;
    for (const block of topLevelBlocks(entities)) {
        blocks.push(...renderParagraphs(text, entities, cursor, block.offset));
        blocks.push(renderBlock(text, entities, block));
        cursor = block.offset + block.length;
    }
    blocks.push(...renderParagraphs(text, entities, cursor, text.length));
    return blocks.join('\n\n');
};
