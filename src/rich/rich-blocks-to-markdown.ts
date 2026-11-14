/**
 * RichBlock tree (Bot API 10.1–10.3 rich messages) → markdown in this
 * package's own input dialect, so the output re-renders through
 * renderMarkdown into a display-equivalent message. Structure-lossy pieces
 * (media, maps, documents, button rows) degrade to text placeholders.
 *
 * Never throws: the block list is JSON the server keeps extending. Entries
 * that are not objects are skipped, an unknown block type renders its text
 * and inner blocks, and a malformed known block degrades the same way.
 */
import { match } from 'ts-pattern';
import { escapeMarkdownText } from './escape-markdown';
import { isRecord, isRichBlockLike, isRichTextLike } from './rich-guards';
import { renderButtonLabel, renderRichText, richTextToPlain } from './rich-text-to-markdown';
import type {
    RichBlockButtons,
    RichBlockCaption,
    RichBlockDocument,
    RichBlockListItem,
    RichBlockNode,
    RichBlocksToMarkdownOptions,
    RichBlockTable,
    RichMediaDetails,
    RichMediaKind,
} from './rich-types';

const DEFAULT_MEDIA_LABELS: Record<RichMediaKind, string> = {
    photo: '[图片]',
    video: '[视频]',
    animation: '[动图]',
    audio: '[音频]',
    voice_note: '[语音]',
    document: '[文件]',
    map: '[地图]',
};

const BUTTONS_LABEL = '[按钮]';
const BUTTON_SEPARATOR = ' · ';

interface RenderContext {
    mediaPlaceholder: (kind: RichMediaKind, caption: string, details: RichMediaDetails) => string;
}

const captionPlain = (caption: RichBlockCaption | undefined): string => {
    if (!caption) return '';
    const credit = caption.credit ? ` — ${richTextToPlain(caption.credit)}` : '';
    return `${richTextToPlain(caption.text)}${credit}`.trim();
};

// A bare [label] with no following (url) stays literal on re-parse, so the
// default labels are emitted unescaped; the file name and caption are escaped.
const defaultMediaPlaceholder = (
    kind: RichMediaKind,
    caption: string,
    details: RichMediaDetails
): string => {
    const fileName = details.fileName ? ` ${escapeMarkdownText(details.fileName)}` : '';
    const label = `${DEFAULT_MEDIA_LABELS[kind]}${fileName}`;
    return caption ? `${label} ${escapeMarkdownText(caption)}` : label;
};

const NO_DETAILS: RichMediaDetails = {};

const documentDetails = (block: RichBlockDocument): RichMediaDetails => {
    const fileName: unknown = isRecord(block.document) ? block.document.file_name : undefined;
    return typeof fileName === 'string' && fileName !== '' ? { fileName } : NO_DETAILS;
};

/** `[按钮] [打开](url) · 签到`: url buttons keep their link, others their label */
const renderButtonRow = (block: RichBlockButtons): string => {
    const buttons = Array.isArray(block.buttons) ? block.buttons : [];
    const labels = buttons
        .map((button) => renderButtonLabel(button))
        .filter((label) => label.trim().length > 0);
    return labels.length > 0 ? `${BUTTONS_LABEL} ${labels.join(BUTTON_SEPARATOR)}` : '';
};

/** The quote forms share one shape: body lines, then `— credit` */
const withCredit = (body: string, credit: RichBlockCaption['credit']): string =>
    credit ? `${body}\n— ${renderRichText(credit)}` : body;

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

/**
 * A block type this version does not know (or a known one too malformed to
 * render): keep its text and inner blocks rather than dropping the content.
 */
const renderUnknownBlock = (block: unknown, context: RenderContext): string => {
    if (!isRecord(block)) return '';
    const text = isRichTextLike(block.text) ? renderRichText(block.text) : '';
    const inner = renderBlocks(block.blocks, context);
    return [text, inner].filter((part) => part.length > 0).join('\n\n');
};

const headingLevel = (size: unknown): number =>
    typeof size === 'number' && Number.isInteger(size) && size >= 1 && size <= 6 ? size : 1;

const renderKnownBlock = (block: RichBlockNode, context: RenderContext): string =>
    match(block)
        .with({ type: 'paragraph' }, (paragraph) => renderRichText(paragraph.text))
        .with({ type: 'heading' }, (heading) =>
            `${'#'.repeat(headingLevel(heading.size))} ${renderRichText(heading.text)}`
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
        .with({ type: 'blockquote' }, (quote) =>
            prefixLines(withCredit(renderBlocks(quote.blocks, context), quote.credit), '>')
        )
        .with({ type: 'pullquote' }, (quote) =>
            prefixLines(withCredit(renderRichText(quote.text), quote.credit), '>')
        )
        // The same form entitiesToMarkdown gives an expandable_blockquote
        // entity: <details> without a summary re-renders as that entity
        .with({ type: 'expandable_blockquote' }, (quote) => {
            const body = withCredit(renderRichText(quote.text), quote.credit);
            return body.trim() === '' ? '' : `<details>\n${body}\n</details>`;
        })
        .with({ type: 'table' }, (table) => renderTable(table, context))
        .with({ type: 'details' }, (details) => {
            const summary = renderRichText(details.summary);
            const body = renderBlocks(details.blocks, context);
            return `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
        })
        .with({ type: 'collage' }, { type: 'slideshow' }, (collage) => {
            const body = renderBlocks(collage.blocks, context);
            const caption = captionPlain(collage.caption);
            return caption ? `${body}\n${escapeMarkdownText(caption)}` : body;
        })
        .with({ type: 'map' }, (map) => {
            const coordinates = `${map.location.latitude},${map.location.longitude}`;
            const caption = captionPlain(map.caption);
            return `${context.mediaPlaceholder('map', caption, NO_DETAILS)} (${coordinates})`;
        })
        .with({ type: 'photo' }, { type: 'video' }, { type: 'animation' }, { type: 'audio' }, { type: 'voice_note' }, (media) =>
            context.mediaPlaceholder(media.type, captionPlain(media.caption), NO_DETAILS)
        )
        .with({ type: 'document' }, (document) =>
            context.mediaPlaceholder('document', captionPlain(document.caption), documentDetails(document))
        )
        .with({ type: 'buttons' }, (row) => renderButtonRow(row))
        .with({ type: 'thinking' }, () => '')
        .otherwise((unknown) => renderUnknownBlock(unknown, context));

const renderBlock = (block: unknown, context: RenderContext): string => {
    if (!isRichBlockLike(block)) return renderUnknownBlock(block, context);
    try {
        return renderKnownBlock(block, context);
    } catch {
        // A known type with a malformed shape (e.g. a list without items)
        return renderUnknownBlock(block, context);
    }
};

const renderBlocks = (blocks: unknown, context: RenderContext): string =>
    Array.isArray(blocks)
        ? blocks
            .map((block) => renderBlock(block, context))
            .filter((rendered) => rendered.length > 0)
            .join('\n\n')
        : '';

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
