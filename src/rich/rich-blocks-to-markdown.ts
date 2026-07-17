/**
 * RichBlock tree (Bot API 10.1+ rich messages) → markdown in this package's
 * own input dialect, so the output re-renders through renderMarkdown into a
 * display-equivalent message. Structure-lossy pieces (media, maps) degrade
 * to text placeholders.
 */
import { match } from 'ts-pattern';
import { escapeMarkdownText } from './escape-markdown';
import { renderRichText, richTextToPlain } from './rich-text-to-markdown';
import type {
    RichBlockCaption,
    RichBlockListItem,
    RichBlockNode,
    RichBlocksToMarkdownOptions,
    RichBlockTable,
    RichMediaKind,
} from './rich-types';

const DEFAULT_MEDIA_LABELS: Record<RichMediaKind, string> = {
    photo: '[图片]',
    video: '[视频]',
    animation: '[动图]',
    audio: '[音频]',
    voice_note: '[语音]',
    map: '[地图]',
};

interface RenderContext {
    mediaPlaceholder: (kind: RichMediaKind, caption: string) => string;
}

const captionPlain = (caption: RichBlockCaption | undefined): string => {
    if (!caption) return '';
    const credit = caption.credit ? ` — ${richTextToPlain(caption.credit)}` : '';
    return `${richTextToPlain(caption.text)}${credit}`.trim();
};

// A bare [label] with no following (url) stays literal on re-parse, so the
// default labels are emitted unescaped; only the user caption is escaped.
const defaultMediaPlaceholder = (kind: RichMediaKind, caption: string): string =>
    caption
        ? `${DEFAULT_MEDIA_LABELS[kind]} ${escapeMarkdownText(caption)}`
        : DEFAULT_MEDIA_LABELS[kind];

const prefixLines = (text: string, prefix: string): string =>
    text
        .split('\n')
        .map((line) => (line.length > 0 ? `${prefix} ${line}` : prefix))
        .join('\n');

const renderFencedBlock = (content: string, language: string): string => {
    const runs = content.match(/`{3,}/g) ?? [];
    const longestRun = runs.reduce((max, run) => Math.max(max, run.length), 0);
    const fence = '`'.repeat(Math.max(3, longestRun + 1));
    const safeLanguage = language.replace(/[^\w+#-]/g, '');
    return `${fence}${safeLanguage}\n${content}\n${fence}`;
};

const renderListItem = (
    item: RichBlockListItem,
    index: number,
    ordered: boolean,
    context: RenderContext
): string => {
    const marker = item.has_checkbox
        ? `- [${item.is_checked ? 'x' : ' '}] `
        : ordered
            ? `${item.value ?? index + 1}. `
            : '- ';

    const body = renderBlocks(item.blocks, context) || ' ';
    const indent = ' '.repeat(marker.length);
    const [firstLine = '', ...restLines] = body.split('\n');
    const continuation = restLines
        .map((line) => (line.length > 0 ? `${indent}${line}` : line))
        .join('\n');
    return `${marker}${firstLine}${restLines.length > 0 ? `\n${continuation}` : ''}`;
};

const renderTable = (block: RichBlockTable, context: RenderContext): string => {
    const inlineCell = (text: string): string => text.replace(/\n/g, ' ').trim();

    const rows = block.cells.map((row) =>
        row.flatMap((cell) => {
            const rendered = cell.text ? inlineCell(renderRichText(cell.text)) : '';
            // colspan degrades to trailing empty cells so columns stay aligned
            const spanPadding = Math.max(0, (cell.colspan ?? 1) - 1);
            return [rendered, ...Array.from({ length: spanPadding }, () => '')];
        })
    );
    if (rows.length === 0) return '';

    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 1);
    const padded = rows.map((row) => [
        ...row,
        ...Array.from({ length: columnCount - row.length }, () => ''),
    ]);

    const headerAligns = block.cells[0]?.map((cell) => cell.align) ?? [];
    const separator = Array.from({ length: columnCount }, (_, column) =>
        match(headerAligns[column])
            .with('center', () => ':---:')
            .with('right', () => '---:')
            .otherwise(() => '---')
    );

    const toLine = (cells: string[]): string => `| ${cells.join(' | ')} |`;
    const [headerRow = [], ...bodyRows] = padded;
    const lines = [toLine(headerRow), toLine(separator), ...bodyRows.map(toLine)];

    const caption = block.caption ? richTextToPlain(block.caption).trim() : '';
    return caption
        ? `**${escapeMarkdownText(caption)}**\n${lines.join('\n')}`
        : lines.join('\n');
};

const renderBlock = (block: RichBlockNode, context: RenderContext): string =>
    match(block)
        .with({ type: 'paragraph' }, (paragraph) => renderRichText(paragraph.text))
        .with({ type: 'heading' }, (heading) =>
            `${'#'.repeat(heading.size)} ${renderRichText(heading.text)}`
        )
        .with({ type: 'pre' }, (pre) =>
            renderFencedBlock(richTextToPlain(pre.text), pre.language ?? '')
        )
        .with({ type: 'footer' }, (footer) => `— ${renderRichText(footer.text)}`)
        .with({ type: 'divider' }, () => '---')
        .with({ type: 'mathematical_expression' }, (expr) =>
            renderFencedBlock(expr.expression, 'latex')
        )
        .with({ type: 'anchor' }, () => '')
        .with({ type: 'list' }, (list) => {
            const ordered = list.items.some(
                (item) => item.value !== undefined || item.type !== undefined
            );
            return list.items
                .map((item, index) => renderListItem(item, index, ordered, context))
                .join('\n');
        })
        .with({ type: 'blockquote' }, (quote) => {
            const body = renderBlocks(quote.blocks, context);
            const credit = quote.credit
                ? `\n— ${renderRichText(quote.credit)}`
                : '';
            return prefixLines(`${body}${credit}`, '>');
        })
        .with({ type: 'pullquote' }, (quote) => {
            const credit = quote.credit
                ? `\n— ${renderRichText(quote.credit)}`
                : '';
            return prefixLines(`${renderRichText(quote.text)}${credit}`, '>');
        })
        .with({ type: 'table' }, (table) => renderTable(table, context))
        .with({ type: 'details' }, (details) => {
            const summary = renderRichText(details.summary);
            const body = renderBlocks(details.blocks, context);
            return `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
        })
        .with({ type: 'collage' }, (collage) => {
            const body = renderBlocks(collage.blocks, context);
            const caption = captionPlain(collage.caption);
            return caption ? `${body}\n${escapeMarkdownText(caption)}` : body;
        })
        .with({ type: 'map' }, (map) => {
            const coordinates = `${map.location.latitude},${map.location.longitude}`;
            const caption = captionPlain(map.caption);
            return `${context.mediaPlaceholder('map', caption)} (${coordinates})`;
        })
        .with({ type: 'photo' }, { type: 'video' }, { type: 'animation' }, { type: 'audio' }, { type: 'voice_note' }, (media) =>
            context.mediaPlaceholder(media.type, captionPlain(media.caption))
        )
        .with({ type: 'thinking' }, () => '')
        .otherwise(() => '');

const renderBlocks = (blocks: RichBlockNode[], context: RenderContext): string =>
    blocks
        .map((block) => renderBlock(block, context))
        .filter((rendered) => rendered.length > 0)
        .join('\n\n');

/**
 * Convert a rich message's block tree to markdown in this package's input
 * dialect. Feed the result to renderMarkdown for a display-equivalent
 * {text, entities} message, or store/quote it as-is.
 */
export const richBlocksToMarkdown = (
    blocks: RichBlockNode[],
    options?: RichBlocksToMarkdownOptions
): string =>
    renderBlocks(blocks, {
        mediaPlaceholder: options?.mediaPlaceholder ?? defaultMediaPlaceholder,
    });
