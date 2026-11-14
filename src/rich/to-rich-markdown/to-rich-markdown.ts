/**
 * This package's markdown dialect → markdown that Telegram's rich-message
 * parser (Bot API sendRichMessage / editMessageText rich_message.markdown)
 * reads the same way.
 *
 * The two dialects disagree where it hurts: Telegram reads '__x__' as bold
 * (here: underline), has no loose '|| x ||' spoiler, drops
 * <span class="tg-spoiler">, follows its own flanking rules (CJK-adjacent
 * '**' may stay literal) and interprets HTML this package shows literally.
 * It also joins a paragraph's lines with a space, reads a line that starts
 * with '#' as a heading even without a space after it, and reads '$…$' as
 * math more eagerly than pandoc. So the source is rewritten at the offsets
 * the package's own parser reports: emphasis, strong, strikethrough and
 * spoilers become tags, HTML the package shows as text is escaped, soft
 * line breaks become hard ones, a '#' that starts a paragraph line and a
 * '$' outside a pandoc math pair are escaped. Where Telegram reads HTML
 * text instead (a <details> summary, see piece-reading.ts) no markdown
 * escape goes in. Every other byte is kept — code, tables, math, links and
 * escapes pass through untouched, which is what makes the native rich
 * rendering worth it.
 */
import { collectRichEdits } from './collect-edits';
import { closeStreamingTail } from './close-streaming-tail';
import { applySourceEdits } from './source-edits';
import type { TextLinker } from './text-links';

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
    /**
     * Links for plain text (e.g. '#12' → the message it refers to), as a bot
     * would add text_link entities after renderMarkdown. Called once per run
     * of literal text, decoded as a reader sees it (escapes and character
     * references resolved, a paragraph's lines joined with '\n'), with the
     * character a reader sees on either side of the run ('' at the edge of
     * its block): a run ends at every inline construct (emphasis, code span,
     * link, HTML tag). Code, link labels, the text of an <a>, <code> or <pre>
     * element and raw HTML blocks never reach it (the summary and body of a
     * <details> element do). Returns ranges of the run
     * (UTF-16 units); each becomes an <a href> tag around its own source
     * characters (a link that starts a paragraph line needs no '\#'). What
     * is next to a range stays as written: Telegram pairs a literal '**',
     * '~~' or '==' beside the tags as it does without them, while escaping
     * them breaks its reading of the line (see text-links.ts). A range is
     * left as it is when its source is not exactly its text (an escape or a
     * character reference in it, an escape right before it), when it sits
     * inside a '$…$' or '$$…$$' formula, when it holds a line break, half of
     * a surrogate pair or a character markdown or HTML could pair with
     * something around it (\ ` * _ ~ | = $ [ ] < > &), when it overlaps a
     * range that starts earlier (ties: the earlier in the array wins), or
     * when its url is not an http(s) URL with a host or a tg URL that an
     * attribute holds as written (no whitespace or control characters,
     * quotes, angle brackets, '&', '\', '`', '|' or '$'). A linker that
     * throws or returns no array links nothing in that run.
     */
    textLinks?: TextLinker;
}

/**
 * Convert markdown in this package's dialect (LLM output, as fed to
 * renderMarkdown) to markdown for Telegram's rich messages. renderMarkdown
 * of the result shows the same text and styles as renderMarkdown of the
 * input, plus the links textLinks asked for (beside which this package's
 * parser may pair a literal '**' or '~' run differently; Telegram does not).
 * Never throws.
 */
export const toRichMarkdown = (markdown: string, options?: RichMarkdownOptions): string => {
    const rewriteOptions = {
        underline: options?.underline ?? true,
        spoilerMode: options?.spoilerMode ?? 'loose',
        textLinks: options?.textLinks,
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
