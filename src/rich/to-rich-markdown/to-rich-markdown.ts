/**
 * This package's markdown dialect → markdown that Telegram's rich-message
 * parser (Bot API sendRichMessage / editMessageText rich_message.markdown)
 * reads the same way.
 *
 * The two dialects disagree where it hurts: Telegram reads '__x__' as bold
 * (here: underline), has no loose '|| x ||' spoiler, drops
 * <span class="tg-spoiler">, follows its own flanking rules (CJK-adjacent
 * '**' may stay literal) and interprets HTML this package shows literally.
 * It also joins a paragraph's lines with a space and reads '$…$' as math
 * more eagerly than pandoc. So the source is rewritten at the offsets the
 * package's own parser reports: emphasis, strong, strikethrough and
 * spoilers become tags, HTML the package shows as text is escaped, soft
 * line breaks become hard ones and a '$' outside a pandoc math pair is
 * escaped. Every other byte is kept — code, tables, math, links and escapes
 * pass through untouched, which is what makes the native rich rendering
 * worth it.
 */
import { collectRichEdits } from './collect-edits';
import { closeStreamingTail } from './close-streaming-tail';
import { applySourceEdits } from './source-edits';

export interface RichMarkdownOptions {
    /**
     * The input is a growing prefix (a streaming buffer): close what is
     * still open first (the same tail repair the streaming render uses,
     * plus open HTML tags and <details>), so text appended after the
     * result never lands inside an unfinished construct. Default false.
     */
    streaming?: boolean;
    /** Same meaning and default as RenderOptions.underline (true: '__x__' is underline) */
    underline?: boolean;
    /** Same meaning and default as RenderOptions.spoilerMode ('loose') */
    spoilerMode?: 'loose' | 'strict';
}

/**
 * Convert markdown in this package's dialect (LLM output, as fed to
 * renderMarkdown) to markdown for Telegram's rich messages. renderMarkdown
 * of the result shows the same text and styles as renderMarkdown of the
 * input. Never throws.
 */
export const toRichMarkdown = (markdown: string, options?: RichMarkdownOptions): string => {
    const rewriteOptions = {
        underline: options?.underline ?? true,
        spoilerMode: options?.spoilerMode ?? 'loose',
    } as const;
    if (!options?.streaming) {
        return applySourceEdits(markdown, collectRichEdits(markdown, rewriteOptions, null));
    }
    const closed = closeStreamingTail(markdown, rewriteOptions.spoilerMode);
    const edits = collectRichEdits(closed.source, rewriteOptions, {
        start: closed.syntheticStart,
        end: closed.syntheticEnd,
    });
    return applySourceEdits(closed.source, edits);
};
