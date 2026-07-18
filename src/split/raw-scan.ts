/**
 * Construct-state scan for raw-markdown splitting: given a cut position in a
 * raw markdown string, report every multi-line construct still open there
 * (fenced code, <details>, html block tags, GFM table, inline formatting).
 * The splitter uses this to prefer cut points where nothing is open, and to
 * synthesize a reopen prefix for the second part when a cut inside a
 * construct is unavoidable.
 */
import { FENCE_LINE, LEAF_RESET, QUOTE_PREFIX } from '../streaming/block-scan';
import { scanInlineTail } from '../streaming/inline-scan';

export interface OpenFenceInfo {
    /** The full opening fence sequence, e.g. '```' */
    sequence: string;
    /** Info string carrying the language, e.g. 'js' */
    info: string;
    /** Container prefix ('> ' chains) the fence lines live under */
    containerPrefix: string;
}

export interface OpenDetailsInfo {
    /** Inner text of the element's <summary>, when one was seen */
    summary: string | null;
}

export interface RawCutState {
    fence: OpenFenceInfo | null;
    /** Open <details> elements, outermost first */
    details: OpenDetailsInfo[];
    /** Open html block container tags (ul/ol/pre), outermost first */
    blockTags: string[];
    /** Table lines (header, delimiter) the second part must repeat */
    tableHeader: string[] | null;
    /** Markdown reopen tokens for inline constructs open at the cut */
    inlineMarkers: string[];
    /** Html formatting tag names open at the cut, outermost first */
    inlineTags: string[];
    /** The cut sits inside a half-written [label](url — never a clean cut */
    halfLink: boolean;
}

export const isCleanCut = (state: RawCutState): boolean =>
    state.fence === null &&
    state.details.length === 0 &&
    state.blockTags.length === 0 &&
    state.tableHeader === null &&
    state.inlineMarkers.length === 0 &&
    state.inlineTags.length === 0 &&
    !state.halfLink;

/** Tags whose open/close pairing the scanner tracks (subset of the renderer's) */
const TRACKED_TAG = /<(\/?)(details|summary|ul|ol|pre|b|strong|i|em|u|ins|s|strike|del|code|tg-spoiler)\b[^<>]*?(\/?)>/gi;
/** <pre> spans blank lines (CommonMark type-1 html); ul/ol do not (type 6) */
const BLANK_SURVIVING_BLOCK_TAGS = new Set(['pre']);
const BLOCK_TAG_NAMES = new Set(['ul', 'ol', 'pre']);
const INLINE_TAG_NAMES = new Set([
    'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'tg-spoiler',
]);

/** GFM delimiter row: pipes, dashes, colons and spaces only (with a dash) */
const TABLE_SEPARATOR = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

const isTableRowLine = (line: string): boolean => /^\s{0,3}\|/.test(line);

interface LineInfo {
    start: number;
    text: string;
}

const splitLines = (raw: string): LineInfo[] => {
    const lines: LineInfo[] = [];
    let start = 0;
    for (const text of raw.split('\n')) {
        lines.push({ start, text });
        start += text.length + 1;
    }
    return lines;
};

interface DetailsFrame {
    summary: string | null;
    capturingSummary: boolean;
}

/**
 * Find the table run (consecutive table-row lines whose second line is a
 * valid GFM delimiter) that the cut is strictly inside, and return the run
 * lines before the cut that the second part must repeat to stay a table
 * (header alone when the cut precedes the delimiter, header + delimiter
 * otherwise). `fencedLine[i]` masks lines inside code fences.
 */
const tableHeaderAtCut = (
    lines: LineInfo[],
    fencedLine: boolean[],
    cut: number
): string[] | null => {
    let runStart = -1;
    for (let index = 0; index <= lines.length; index += 1) {
        const line = lines[index];
        const isRow = line !== undefined && !fencedLine[index] && isTableRowLine(line.text);
        if (isRow && runStart === -1) runStart = index;
        if (isRow) continue;
        if (runStart !== -1) {
            const runEnd = index; // exclusive
            const header = lines[runStart];
            const separator = lines[runStart + 1];
            const lastLine = lines[runEnd - 1];
            const runEndOffset =
                lines[runEnd]?.start ??
                (lastLine === undefined ? 0 : lastLine.start + lastLine.text.length);
            const isValidTable =
                runEnd - runStart >= 2 &&
                header !== undefined &&
                separator !== undefined &&
                TABLE_SEPARATOR.test(separator.text);
            // Strictly inside: past the header line's start, before the run's
            // end — a cut at either edge leaves both halves whole
            if (isValidTable && cut > header.start && cut < runEndOffset) {
                const beforeCut = [header, separator].filter((info) => info.start < cut);
                return beforeCut.map((info) => info.text);
            }
            runStart = -1;
        }
    }
    return null;
};

export const scanRawCut = (raw: string, cut: number): RawCutState => {
    const lines = splitLines(raw);
    const fencedLine: boolean[] = [];

    let fence: OpenFenceInfo | null = null;
    let fenceSize = 0;
    let fenceMarker = '';
    const detailsStack: DetailsFrame[] = [];
    let blockTags: string[] = [];
    let inlineTags: string[] = [];
    let leafBlockStart = 0;

    const scanTagsInLine = (text: string): void => {
        const top = (): DetailsFrame | undefined => detailsStack[detailsStack.length - 1];
        // Summary capture may have started on a previous line
        let summaryFrom = top()?.capturingSummary ? 0 : -1;
        const scanner = new RegExp(TRACKED_TAG.source, 'gi');
        let matched = scanner.exec(text);
        while (matched !== null) {
            const closing = matched[1] === '/';
            const selfClosing = matched[3] === '/';
            const name = (matched[2] ?? '').toLowerCase();
            const frame = top();

            if (closing && name === 'summary' && frame?.capturingSummary) {
                frame.summary = (frame.summary ?? '') + text.slice(summaryFrom, matched.index);
                frame.capturingSummary = false;
                summaryFrom = -1;
            } else if (name === 'details') {
                if (closing) detailsStack.pop();
                else if (!selfClosing) {
                    detailsStack.push({ summary: null, capturingSummary: false });
                }
            } else if (
                !closing &&
                name === 'summary' &&
                frame !== undefined &&
                frame.summary === null &&
                !frame.capturingSummary
            ) {
                frame.capturingSummary = true;
                summaryFrom = matched.index + matched[0].length;
            } else if (BLOCK_TAG_NAMES.has(name) && !selfClosing) {
                if (closing) {
                    const index = blockTags.lastIndexOf(name);
                    if (index >= 0) blockTags.splice(index, 1);
                } else {
                    blockTags.push(name);
                }
            } else if (INLINE_TAG_NAMES.has(name) && !selfClosing) {
                if (closing) {
                    const index = inlineTags.lastIndexOf(name);
                    if (index >= 0) inlineTags.splice(index, 1);
                } else {
                    inlineTags.push(name);
                }
            }
            matched = scanner.exec(text);
        }
        const frame = top();
        if (frame?.capturingSummary) {
            frame.summary =
                (frame.summary ?? '') + (summaryFrom >= 0 ? text.slice(summaryFrom) : text) + '\n';
        }
    };

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line === undefined) break;
        if (line.start >= cut) {
            // Beyond the cut: only the fence mask (frozen state) is needed
            fencedLine[index] = fence !== null;
            continue;
        }
        const newlinePos = line.start + line.text.length;
        const isWholeLine = newlinePos < cut;
        // The cut line itself contributes only its prefix
        const text = isWholeLine ? line.text : line.text.slice(0, cut - line.start);
        const nextLineStart = newlinePos + 1;

        const quoteMatch = text.match(QUOTE_PREFIX);
        const containerPrefix = quoteMatch?.[0] ?? '';
        const stripped = quoteMatch ? text.slice(containerPrefix.length) : text;

        fencedLine[index] = fence !== null;

        if (fence !== null) {
            const close = stripped.match(FENCE_LINE);
            if (
                isWholeLine &&
                close?.[1] &&
                close[1][0] === fenceMarker &&
                close[1].length >= fenceSize &&
                close[2]?.trim() === ''
            ) {
                fence = null;
                leafBlockStart = nextLineStart;
            }
            continue;
        }

        const open = stripped.match(FENCE_LINE);
        if (isWholeLine && open?.[1]) {
            const marker = open[1][0] === '~' ? '~' : '`';
            if (marker === '~' || !open[2]?.includes('`')) {
                fence = {
                    sequence: open[1],
                    info: (open[2] ?? '').trim(),
                    containerPrefix,
                };
                fenceMarker = marker;
                fenceSize = open[1].length;
                leafBlockStart = nextLineStart;
                // The fence starts a new block: open html tags flushed before it
                inlineTags = [];
                continue;
            }
        }

        scanTagsInLine(text);

        if (stripped.trim() === '') {
            leafBlockStart = nextLineStart;
            // A blank line ends the block: the renderer flushes open html
            // formatting tags and type-6 block tags (ul/ol) there, so they
            // are not open constructs for a cut past this point
            inlineTags = [];
            blockTags = blockTags.filter((tag) => BLANK_SURVIVING_BLOCK_TAGS.has(tag));
        } else if (LEAF_RESET.test(stripped)) {
            leafBlockStart = line.start;
            inlineTags = [];
        }
    }

    // Inline markdown constructs only exist outside fences
    let inlineMarkers: string[] = [];
    let halfLink = false;
    if (fence === null) {
        const prefix = raw.slice(0, cut);
        const tail = scanInlineTail(prefix, Math.min(leafBlockStart, cut));
        inlineMarkers = tail.openStack.map((entry) =>
            entry.marker === '*' || entry.marker === '_' || entry.marker === '`'
                ? entry.marker.repeat(entry.size)
                : entry.marker
        );
        halfLink = tail.splicedBuffer !== prefix;
    }

    return {
        fence,
        details: detailsStack.map((frame) => ({ summary: frame.summary })),
        blockTags: [...blockTags],
        tableHeader: fence === null ? tableHeaderAtCut(lines, fencedLine, cut) : null,
        inlineMarkers,
        inlineTags: [...inlineTags],
        halfLink,
    };
};
