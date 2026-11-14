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

/**
 * Where extractLeadingSummary's pieces sit in raw (same patterns): the
 * summary is raw[summaryStart, summaryEnd), the rest starts at restStart.
 * For callers that rewrite the source in place instead of re-rendering it.
 */
export const locateLeadingSummary = (
    raw: string
): { summaryStart: number; summaryEnd: number; restStart: number } | null => {
    const located =
        new RegExp(SUMMARY_CLOSED.source, 'id').exec(raw) ??
        new RegExp(SUMMARY_UNCLOSED.source, 'id').exec(raw);
    const summarySpan = located?.indices?.[1];
    if (!located || !summarySpan) return null;
    return {
        summaryStart: summarySpan[0],
        summaryEnd: summarySpan[1],
        restStart: located.index + located[0].length,
    };
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

/** The text cleanDetailsFragment(raw, false) gives, plus where each char came from */
export interface CleanedFragment {
    text: string;
    /** rawOffsets[i] is the raw index of text[i] (a <br> maps to its '<') */
    rawOffsets: number[];
}

/** cleanDetailsFragment without the tail drop, keeping a map back into raw */
export const cleanDetailsFragmentWithOffsets = (raw: string): CleanedFragment => {
    let text = '';
    const rawOffsets: number[] = [];
    const scanner = new RegExp(BR_TAG.source, 'gi');
    let cursor = 0;
    const copyUpTo = (end: number): void => {
        for (let index = cursor; index < end; index += 1) {
            text += raw[index] ?? '';
            rawOffsets.push(index);
        }
    };
    let matched = scanner.exec(raw);
    while (matched !== null) {
        copyUpTo(matched.index);
        text += '\n';
        rawOffsets.push(matched.index);
        cursor = matched.index + matched[0].length;
        matched = scanner.exec(raw);
    }
    copyUpTo(raw.length);

    const leading = text.length - text.trimStart().length;
    const kept = text.trim().length;
    return {
        text: text.slice(leading, leading + kept),
        rawOffsets: rawOffsets.slice(leading, leading + kept),
    };
};

/** A partial tag at the very end of a streaming buffer, e.g. `<b` or `</det` */
export const stripPartialTailTag = (raw: string): string => raw.replace(PARTIAL_TAIL_TAG, '');
