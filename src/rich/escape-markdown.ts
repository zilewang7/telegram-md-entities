/**
 * Escaping for the reverse direction (structured content → markdown in this
 * package's own input dialect). The acceptance rule is round-trip display
 * equivalence: renderMarkdown(escaped) must show exactly the original text.
 */

/** Inline characters that can open constructs anywhere in a line */
const INLINE_SPECIALS = /[\\`*_[\]~|<>&]/g;

const escapeLine = (line: string): string => {
    let escaped = line.replace(INLINE_SPECIALS, (char) => `\\${char}`);

    // Block starters only bite at the start of a line: ATX headings, list
    // bullets, hr / setext underlines. ('>' is already covered above.)
    escaped = escaped.replace(/^(\s*)([#+=-])/, '$1\\$2');
    // Ordered-list starters: "1. " / "1) "
    escaped = escaped.replace(/^(\s*)(\d+)([.)])(?=\s|$)/, '$1$2\\$3');
    // 4-space indentation would become an indented code block
    escaped = escaped.replace(/^ {4,}/, '   ');

    return escaped;
};

/** Escape plain text so it survives a markdown re-parse verbatim */
export const escapeMarkdownText = (text: string): string =>
    text.split('\n').map(escapeLine).join('\n');

/** Make a URL safe inside [label](url) — parens and whitespace break it.
 * (encodeURIComponent leaves parens alone, so percent-encode by hand.) */
export const escapeMarkdownUrl = (url: string): string =>
    url.replace(/[()\s]/g, (char) =>
        `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`
    );

/** Wrap inline code, extending the backtick fence past any inner runs */
export const wrapInlineCode = (content: string): string => {
    // Inline code cannot represent newlines; spaces are display-equivalent
    const flattened = content.replace(/\n/g, ' ');
    if (flattened.trim().length === 0) return flattened;

    const runs = flattened.match(/`+/g) ?? [];
    const longestRun = runs.reduce((max, run) => Math.max(max, run.length), 0);
    const fence = '`'.repeat(longestRun + 1);
    // CommonMark strips one leading/trailing space pair; pad when the content
    // touches the fence with a backtick or space so it survives unchanged
    const needsPadding = /^[` ]|[` ]$/.test(flattened);
    const padding = needsPadding ? ' ' : '';
    return `${fence}${padding}${flattened}${padding}${fence}`;
};
