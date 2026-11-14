/**
 * Line endings around '$$…$$' that must reach Telegram as written. Inside a
 * formula a newline is part of the display math, and a backslash there
 * breaks it. A formula whose opening '$$' starts a line is a block to
 * Telegram (measured: 'a\n$$\nx\n$$\nb' is paragraph, math block,
 * paragraph): a backslash before that line, or after its closing line,
 * would show up literally and leave the block unclosed.
 */
import { displayFormulas } from './dollar-runs';

/** Only a quote prefix or indentation between the line start and offset */
const startsLine = (source: string, offset: number): boolean => {
    const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
    return /^[ \t>]*$/.test(source.slice(lineStart, offset));
};

/** Only whitespace between offset and the line end */
const endsLine = (source: string, offset: number): boolean => {
    const lineEnd = source.indexOf('\n', offset);
    return source.slice(offset, lineEnd === -1 ? source.length : lineEnd).trim() === '';
};

/** Offsets of the newlines in source[start, end) to leave as written */
export const formulaLineEndings = (source: string, start: number, end: number): Set<number> => {
    const untouched = new Set<number>();
    for (const { opener, closer } of displayFormulas(source, start, end)) {
        const closerEnd = closer.at + closer.length;
        for (let index = opener.at + opener.length; index < closer.at; index += 1) {
            if (source[index] === '\n') untouched.add(index);
        }
        if (!startsLine(source, opener.at)) continue;
        const before = source.lastIndexOf('\n', opener.at - 1);
        if (before >= start) untouched.add(before);
        if (!endsLine(source, closerEnd)) continue;
        const after = source.indexOf('\n', closerEnd);
        if (after !== -1 && after < end) untouched.add(after);
    }
    return untouched;
};
