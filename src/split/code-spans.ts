/**
 * Where a raw markdown text has code spans, by the package's own parser: a
 * tag written as code ('`<pre>`') opens nothing, so the raw scan must not
 * count it. Pairing backticks by hand gets CommonMark wrong where it matters
 * here (a lone backtick is literal, a paragraph ends at an html block line),
 * so the parser decides. Inside an html block there is no code span (a
 * backtick there is text), which is also how Telegram reads a <summary>.
 *
 * A code span never crosses a blank line, so each run of non-blank lines is
 * parsed on its own, only when it holds both a backtick and a '<', and its
 * spans are remembered: a split scans one text at many cuts, and the next
 * part of a long text repeats most of its runs.
 */
import type { Nodes } from 'mdast';
import { parseMarkdown } from '../render/parse';

export interface CodeSpanRange {
    /** Offsets [start, end), backticks included */
    start: number;
    end: number;
}

const NONE: readonly CodeSpanRange[] = [];

const collectCodeSpans = (node: Nodes, found: CodeSpanRange[]): void => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (node.type === 'inlineCode' && start !== undefined && end !== undefined) {
        found.push({ start, end });
        return;
    }
    if ('children' in node) {
        for (const child of node.children) collectCodeSpans(child, found);
    }
};

/** Runs of lines parsed so far → their code spans, relative to the run */
const parsedRuns = new Map<string, readonly CodeSpanRange[]>();
const PARSED_RUNS_LIMIT = 2048;

const codeSpansOfRun = (run: string): readonly CodeSpanRange[] => {
    if (!run.includes('`') || !run.includes('<')) return NONE;
    const known = parsedRuns.get(run);
    if (known !== undefined) return known;
    const found: CodeSpanRange[] = [];
    collectCodeSpans(parseMarkdown(run, { spoiler: true, spoilerMode: 'loose' }), found);
    if (parsedRuns.size >= PARSED_RUNS_LIMIT) parsedRuns.clear();
    parsedRuns.set(run, found);
    return found;
};

interface LineSpan {
    start: number;
    text: string;
}

/** The part of line `lineIndex` to scan, with what code spans cover turned into spaces (same length) */
export type LineMasker = (lineIndex: number, part: string) => string;

/** A masker for the lines of raw (each { start, text }, no newline), called in line order */
export const codeSpanMasker = (raw: string, lines: readonly LineSpan[]): LineMasker => {
    let runEndLine = -1;
    let ranges: readonly CodeSpanRange[] = NONE;
    let nextRange = 0;

    /** The run of non-blank lines that starts at line `first` */
    const startRun = (first: number): void => {
        let last = first;
        while (last + 1 < lines.length && (lines[last + 1]?.text.trim() ?? '') !== '') last += 1;
        const runStart = lines[first]?.start ?? 0;
        const lastLine = lines[last];
        const runEnd = lastLine === undefined ? runStart : lastLine.start + lastLine.text.length;
        ranges = codeSpansOfRun(raw.slice(runStart, runEnd)).map((range) => ({
            start: range.start + runStart,
            end: range.end + runStart,
        }));
        nextRange = 0;
        runEndLine = last;
    };

    return (lineIndex: number, part: string): string => {
        const line = lines[lineIndex];
        if (line === undefined || line.text.trim() === '') return part;
        if (lineIndex > runEndLine) startRun(lineIndex);
        while (nextRange < ranges.length && (ranges[nextRange]?.end ?? 0) <= line.start) nextRange += 1;
        const partEnd = line.start + part.length;
        let masked = part;
        for (let index = nextRange; index < ranges.length; index += 1) {
            const range = ranges[index];
            if (range === undefined || range.start >= partEnd) break;
            const from = Math.max(range.start, line.start) - line.start;
            const to = Math.min(range.end, partEnd) - line.start;
            masked = masked.slice(0, from) + ' '.repeat(to - from) + masked.slice(to);
        }
        return masked;
    };
};
