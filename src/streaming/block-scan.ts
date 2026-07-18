/**
 * Line-level scan of a streaming buffer: tracks whether the tail sits inside
 * an unclosed fenced code block (which suppresses all inline repair) and
 * where the current leaf block begins (the region inline repair may scan).
 */

export interface OpenFence {
    marker: '`' | '~';
    size: number;
    /** Container prefix ('> ' chains) the closing fence line must carry */
    containerPrefix: string;
}

export interface BlockState {
    openFence: OpenFence | null;
    /** Raw index where the current leaf block starts (inline-scan region) */
    leafBlockStart: number;
}

export const QUOTE_PREFIX = /^(?:[ ]{0,3}>[ ]?)+/;
export const FENCE_LINE = /^[ ]{0,3}(`{3,}|~{3,})(.*)$/;
/** Lines that start a fresh leaf block — inline constructs never span them */
export const LEAF_RESET = /^(?:#{1,6}\s|[-*+]\s|\d{1,9}[.)]\s|\||[ ]{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$)/;

export const scanBlockState = (buffer: string): BlockState => {
    let openFence: OpenFence | null = null;
    let leafBlockStart = 0;
    let offset = 0;

    for (const line of buffer.split('\n')) {
        const lineStart = offset;
        offset += line.length + 1;
        const nextLineStart = offset;

        const quoteMatch = line.match(QUOTE_PREFIX);
        const containerPrefix = quoteMatch?.[0] ?? '';
        const stripped = quoteMatch ? line.slice(containerPrefix.length) : line;

        if (openFence) {
            const fence = stripped.match(FENCE_LINE);
            if (
                fence?.[1] &&
                fence[1][0] === openFence.marker &&
                fence[1].length >= openFence.size &&
                fence[2]?.trim() === ''
            ) {
                openFence = null;
                leafBlockStart = nextLineStart;
            }
            continue;
        }

        const fence = stripped.match(FENCE_LINE);
        if (fence?.[1]) {
            const marker = fence[1][0] === '~' ? '~' : '`';
            // Backtick fences forbid backticks in the info string
            if (marker === '~' || !fence[2]?.includes('`')) {
                openFence = { marker, size: fence[1].length, containerPrefix };
                leafBlockStart = nextLineStart;
                continue;
            }
        }

        if (stripped.trim() === '') {
            leafBlockStart = nextLineStart;
        } else if (LEAF_RESET.test(stripped)) {
            leafBlockStart = lineStart;
        }
    }

    return { openFence, leafBlockStart: Math.min(leafBlockStart, buffer.length) };
};
