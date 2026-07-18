/**
 * Raw-markdown splitter for streaming continuations: cuts a raw markdown
 * buffer so the first part fits caller-measured budgets, preferring
 * paragraph/newline boundaries where NO multi-line construct is open. When
 * every acceptable boundary sits inside a construct (a giant code block,
 * <details> element or table), the cut is repaired instead: the second part
 * gets a synthetic reopen prefix (fence line, <details><summary>…, table
 * header, inline markers) so both halves render as complete documents —
 * the raw-level mirror of splitMessage's close-and-reopen for entities.
 *
 * Render the first part with { streaming: true } — it may end with unclosed
 * constructs, which the streaming repair closes cleanly.
 */
import { isCleanCut, scanRawCut, type RawCutState } from './raw-scan';

export interface RawSplitResult {
    head: string;
    rest: string;
}

export interface SplitRawOptions {
    /** Suffix appended to a repeated <summary> in a reopen prefix */
    continuedLabel?: string;
}

/** Sentence-ending characters usable as split boundaries */
const SENTENCE_ENDINGS = new Set(['。', '！', '？', '；', '!', '?', ';', '.']);

/** Weak boundaries: better than a mid-word cut, worse than a sentence end */
const WEAK_BOUNDARIES = new Set([' ', '，', ',', '、']);

/** Sentence/weak boundaries are only accepted in the last quarter before the limit */
const BOUNDARY_WINDOW_RATIO = 0.75;

/** Paragraph/newline boundaries are accepted anywhere past this ratio —
 *  boundary quality beats proximity: a clean line break is worth sending less */
const NEWLINE_FLOOR_RATIO = 0.25;

const DEFAULT_CONTINUED_LABEL = '（续）';

/** Cut positions right after '\n\n', descending */
const paragraphCuts = (raw: string, from: number, to: number): number[] => {
    const cuts: number[] = [];
    let index = raw.indexOf('\n\n', from);
    while (index >= 0 && index + 2 <= to) {
        if (index >= from) cuts.push(index + 2);
        index = raw.indexOf('\n\n', index + 1);
    }
    return cuts.reverse();
};

/** Cut positions right after '\n', descending */
const newlineCuts = (raw: string, from: number, to: number): number[] => {
    const cuts: number[] = [];
    for (let index = to - 1; index >= from; index -= 1) {
        if (raw[index - 1] === '\n') cuts.push(index);
    }
    return cuts;
};

/** Cut positions right after a boundary character, descending */
const charCuts = (raw: string, from: number, to: number, chars: Set<string>): number[] => {
    const cuts: number[] = [];
    for (let index = to - 1; index >= from; index -= 1) {
        const char = raw[index - 1];
        if (char !== undefined && chars.has(char)) cuts.push(index);
    }
    return cuts;
};

/** Synthetic markup that re-establishes every open construct for the rest */
const buildReopenPrefix = (state: RawCutState, options: SplitRawOptions): string => {
    const label = options.continuedLabel ?? DEFAULT_CONTINUED_LABEL;
    const parts: string[] = [];
    for (const details of state.details) {
        const summary = details.summary?.trim() ?? '';
        parts.push(`<details>\n<summary>${summary}${label}</summary>\n\n`);
    }
    for (const tag of state.blockTags) {
        parts.push(`<${tag}>\n`);
    }
    if (state.tableHeader !== null) {
        parts.push(state.tableHeader.map((line) => `${line}\n`).join(''));
    }
    if (state.fence !== null) {
        parts.push(`${state.fence.containerPrefix}${state.fence.sequence}${state.fence.info}\n`);
    }
    parts.push(...state.inlineTags.map((tag) => `<${tag}>`));
    parts.push(...state.inlineMarkers);
    return parts.join('');
};

/** Never split inside a surrogate pair (e.g. emoji) */
const guardSurrogate = (raw: string, position: number): number => {
    const before = raw.charCodeAt(position - 1);
    return before >= 0xd800 && before <= 0xdbff ? position - 1 : position;
};

const splitAt = (raw: string, cut: number, options: SplitRawOptions): RawSplitResult => {
    const state = scanRawCut(raw, cut);
    const prefix = isCleanCut(state) ? '' : buildReopenPrefix(state, options);
    return { head: raw.slice(0, cut), rest: prefix + raw.slice(cut) };
};

/**
 * Split raw markdown so that `fits(head)` holds — the predicate measures the
 * ACTUAL rendered output (exact, no expansion-factor guessing; rendering a 4k
 * prefix is <1ms so the binary search is cheap). The cut prefers clean
 * paragraph/newline/sentence boundaries; inside oversized constructs it
 * falls back to cut-and-reopen.
 */
export const splitRawMarkdown = (
    raw: string,
    fits: (prefix: string) => boolean,
    options: SplitRawOptions = {}
): RawSplitResult => {
    if (fits(raw)) {
        return { head: raw, rest: '' };
    }

    // Binary search the largest raw prefix that fits
    // (rendered size is monotonic in the raw prefix length)
    let low = 0;
    let high = raw.length;
    while (low + 1 < high) {
        const mid = (low + high) >> 1;
        if (fits(raw.slice(0, mid))) {
            low = mid;
        } else {
            high = mid;
        }
    }

    const cutPos = low;
    if (cutPos === 0) {
        return { head: '', rest: raw };
    }

    const floor = Math.floor(cutPos * NEWLINE_FLOOR_RATIO);
    const minPos = Math.floor(cutPos * BOUNDARY_WINDOW_RATIO);

    // Tiered candidates, each descending (nearest to the limit first):
    // clean boundaries win over proximity, higher tiers win over lower ones.
    // The last two tiers go below the floor — sending a short head beats
    // cutting a construct in half when the construct would fit whole in the
    // next message
    const tiers: number[][] = [
        paragraphCuts(raw, floor, cutPos),
        newlineCuts(raw, floor, cutPos),
        charCuts(raw, minPos, cutPos, SENTENCE_ENDINGS),
        charCuts(raw, minPos, cutPos, WEAK_BOUNDARIES),
        charCuts(raw, floor, minPos, SENTENCE_ENDINGS),
        charCuts(raw, floor, minPos, WEAK_BOUNDARIES),
        paragraphCuts(raw, 1, floor),
        newlineCuts(raw, 1, floor),
    ];
    for (const tier of tiers) {
        for (const cut of tier) {
            if (isCleanCut(scanRawCut(raw, cut))) {
                return { head: raw.slice(0, cut), rest: raw.slice(cut) };
            }
        }
    }

    // No clean boundary exists (the whole window sits inside a construct):
    // cut at the best line boundary and repair with a reopen prefix
    const lineCut =
        paragraphCuts(raw, floor, cutPos)[0] ?? newlineCuts(raw, floor, cutPos)[0];
    if (lineCut !== undefined) {
        return splitAt(raw, lineCut, options);
    }

    // Not even a newline (one enormous line): sentence/weak boundary, then
    // a guarded hard cut
    const charCut =
        charCuts(raw, minPos, cutPos, SENTENCE_ENDINGS)[0] ??
        charCuts(raw, minPos, cutPos, WEAK_BOUNDARIES)[0] ??
        guardSurrogate(raw, cutPos);
    return splitAt(raw, charCut, options);
};

/**
 * Cut raw markdown right after its last CLEAN paragraph break (falling back
 * to the last clean newline) at or past `minPos`. For closing a streaming
 * message on a tidy line boundary; `head` is empty when no boundary
 * qualifies — callers decide whether to move everything or keep all.
 */
export const splitRawMarkdownAtNewline = (
    raw: string,
    minPos: number = 0
): RawSplitResult => {
    for (let index = raw.lastIndexOf('\n\n'); index >= minPos; index = raw.lastIndexOf('\n\n', index - 1)) {
        if (isCleanCut(scanRawCut(raw, index + 2))) {
            return { head: raw.slice(0, index), rest: raw.slice(index + 2) };
        }
    }
    for (let index = raw.lastIndexOf('\n'); index >= minPos; index = raw.lastIndexOf('\n', index - 1)) {
        if (isCleanCut(scanRawCut(raw, index + 1))) {
            return { head: raw.slice(0, index), rest: raw.slice(index + 1) };
        }
    }
    return { head: '', rest: raw };
};
