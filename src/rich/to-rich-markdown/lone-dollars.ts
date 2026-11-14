/**
 * Telegram's rich parser reads '$…$' as inline math and pairs a '$' with
 * the nearest following one: '价格$5和$10之间' becomes math over '5和'.
 * This package shows every '$' literally, but math is one of the reasons
 * to send rich messages, so real formulas stay. Inside one text node, a
 * single '$' and the very next '$' are kept as a formula when they look
 * like one (pandoc's tex_math_dollars conditions); every other single '$'
 * gets a backslash. A kept pair therefore never contains another '$', so
 * the result does not depend on how Telegram pairs. '$$' runs are left as
 * written; they still count as the next '$'.
 */
import type { SourceEdit } from './source-edits';

interface DollarRun {
    /** Source offset of the first '$' */
    at: number;
    length: number;
}

const isWhitespace = (char: string | undefined): boolean => char === undefined || /\s/.test(char);
const isDigit = (char: string | undefined): boolean => char !== undefined && /[0-9]/.test(char);
const isAsciiPunctuation = (char: string | undefined): boolean =>
    char !== undefined && /[!-/:-@[-`{-~]/.test(char);

/** The unescaped '$' runs in source[start, end), in order */
const dollarRuns = (source: string, start: number, end: number): DollarRun[] => {
    const runs: DollarRun[] = [];
    let index = start;
    while (index < end) {
        const char = source[index];
        if (char === '\\' && index + 1 < end && isAsciiPunctuation(source[index + 1])) {
            index += 2;
            continue;
        }
        if (char === '$') {
            let runEnd = index;
            while (runEnd < end && source[runEnd] === '$') runEnd += 1;
            runs.push({ at: index, length: runEnd - index });
            index = runEnd;
            continue;
        }
        index += 1;
    }
    return runs;
};

/**
 * Pandoc's conditions: a non-space right after the opener, a non-space
 * right before the closer, no digit right after the closer.
 */
const isFormula = (source: string, opener: number, closer: number, end: number): boolean =>
    !isWhitespace(source[opener + 1]) &&
    !isWhitespace(source[closer - 1]) &&
    !(closer + 1 < end && isDigit(source[closer + 1]));

export const loneDollarEdits = (source: string, start: number, end: number): SourceEdit[] => {
    const runs = dollarRuns(source, start, end);
    const edits: SourceEdit[] = [];
    let index = 0;
    while (index < runs.length) {
        const current = runs[index];
        if (current === undefined) break;
        if (current.length > 1) {
            index += 1;
            continue;
        }
        const next = runs[index + 1];
        if (next !== undefined && next.length === 1 && isFormula(source, current.at, next.at, end)) {
            index += 2;
            continue;
        }
        edits.push({ start: current.at, end: current.at + 1, text: '\\$' });
        index += 1;
    }
    return edits;
};
