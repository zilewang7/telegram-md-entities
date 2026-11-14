/**
 * Telegram's rich parser reads '$…$' as inline math with a looser rule
 * than pandoc's: '价格$5和$10之间' becomes math over '5和'. This package
 * shows every '$' literally, but math is one of the reasons to send rich
 * messages, so real formulas stay: a '$' survives only when it is part of
 * a pair pandoc's tex_math_dollars would accept, inside one text node.
 * Every other single '$' gets a backslash. '$$' runs are left as written.
 */
import type { SourceEdit } from './source-edits';

const isWhitespace = (char: string | undefined): boolean => char === undefined || /\s/.test(char);
const isDigit = (char: string | undefined): boolean => char !== undefined && /[0-9]/.test(char);
const isAsciiPunctuation = (char: string | undefined): boolean =>
    char !== undefined && /[!-/:-@[-`{-~]/.test(char);

/** Source offsets of the single, unescaped '$' in source[start, end) */
const singleDollars = (source: string, start: number, end: number): number[] => {
    const found: number[] = [];
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
            if (runEnd - index === 1) found.push(index);
            index = runEnd;
            continue;
        }
        index += 1;
    }
    return found;
};

/** Pandoc: an opener has a non-space right after it */
const canOpen = (source: string, at: number, end: number): boolean =>
    at + 1 < end && !isWhitespace(source[at + 1]);

/** Pandoc: a closer has a non-space right before it and no digit right after */
const canClose = (source: string, at: number, end: number): boolean =>
    !isWhitespace(source[at - 1]) && !(at + 1 < end && isDigit(source[at + 1]));

export const loneDollarEdits = (source: string, start: number, end: number): SourceEdit[] => {
    const dollars = singleDollars(source, start, end);
    const lone: number[] = [];
    let index = 0;
    while (index < dollars.length) {
        const opener = dollars[index];
        if (opener === undefined) break;
        const closerIndex = canOpen(source, opener, end)
            ? dollars.findIndex((at, position) => position > index && canClose(source, at, end))
            : -1;
        if (closerIndex === -1) {
            lone.push(opener);
            index += 1;
        } else {
            // A '$' between the pair is part of the formula
            index = closerIndex + 1;
        }
    }
    return lone.map((at) => ({ start: at, end: at + 1, text: '\\$' }));
};
