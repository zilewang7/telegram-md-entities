/**
 * Raw-string helpers for <details>/<summary> HTML → expandable blockquote.
 *
 * LLM output uses this HTML pattern for collapsible content; Telegram's
 * expandable blockquote is the native equivalent (summary → bold header
 * line). mdast keeps raw HTML as opaque html blocks — contiguous lines land
 * in one block, while blank-line-separated markdown in between parses as
 * regular blocks — so one details element can span several sibling nodes.
 * These helpers handle the string side; the walker stitches the parts.
 */

const OPEN_TAG = /^<details(?:\s[^>]*)?>/i;
const DETAILS_TAG = /<details(?:\s[^>]*)?>|<\/details\s*>/gi;
const SUMMARY_CLOSED = /^\s*<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary\s*>/i;
// Unclosed <summary> (streaming cut): take everything up to a </details>
const SUMMARY_UNCLOSED = /^\s*<summary(?:\s[^>]*)?>((?:(?!<\/details)[\s\S])*)/i;
const BR_TAG = /<br\s*\/?>/gi;
const PARTIAL_TAIL_TAG = /<\/?[a-zA-Z][^<>]*$/;

/** Strip a leading <details ...> tag; null when raw is not a details opener */
export const stripDetailsOpenTag = (raw: string): string | null => {
    const match = OPEN_TAG.exec(raw);
    return match ? raw.slice(match[0].length) : null;
};

/**
 * Extract a leading <summary>…</summary>. An unclosed <summary> (streaming
 * buffer cut mid-summary) leniently takes the rest of the string.
 */
export const extractLeadingSummary = (
    raw: string
): { summary: string; rest: string } | null => {
    const closed = SUMMARY_CLOSED.exec(raw);
    if (closed) return { summary: closed[1] ?? '', rest: raw.slice(closed[0].length) };
    const unclosed = SUMMARY_UNCLOSED.exec(raw);
    if (unclosed) return { summary: unclosed[1] ?? '', rest: raw.slice(unclosed[0].length) };
    return null;
};

export type DetailsCloseScan =
    | { closed: true; inside: string; after: string }
    | { closed: false; depth: number };

/**
 * Find the </details> that closes the element `openDepth` levels up,
 * skipping closes paired with nested <details> opens inside raw. When no
 * such close exists, report the depth carried into the next sibling.
 */
export const scanForDetailsClose = (raw: string, openDepth: number): DetailsCloseScan => {
    let depth = openDepth;
    const scanner = new RegExp(DETAILS_TAG.source, 'gi');
    let match = scanner.exec(raw);
    while (match !== null) {
        if (match[0].startsWith('</')) {
            if (depth === 0) {
                return {
                    closed: true,
                    inside: raw.slice(0, match.index),
                    after: raw.slice(match.index + match[0].length),
                };
            }
            depth -= 1;
        } else {
            depth += 1;
        }
        match = scanner.exec(raw);
    }
    return { closed: false, depth };
};

/**
 * Prepare a raw slice for markdown re-parsing: <br> → newline; optionally
 * drop a half-typed trailing tag (streaming buffers cut mid-tag — only
 * applied while the element is still unclosed, so a complete document
 * renders identically in streaming and strict mode).
 */
export const cleanDetailsFragment = (raw: string, dropPartialTailTag: boolean): string => {
    const unbroken = raw.replace(BR_TAG, '\n');
    const stripped = dropPartialTailTag ? unbroken.replace(PARTIAL_TAIL_TAG, '') : unbroken;
    return stripped.trim();
};
