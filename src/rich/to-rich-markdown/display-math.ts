/**
 * '$$…$$' display formulas must reach Telegram exactly as written. They are
 * paired over a whole leaf block (a paragraph, heading or table cell),
 * because markup inside a formula ('||x||_2', 'x^* … x^*') splits it into
 * several mdast nodes. Inside a formula nothing is rewritten: no tags, no
 * escapes, no hard breaks. A formula whose opening '$$' starts a line is a
 * block to Telegram (measured: 'a\n$$\nx\n$$\nb' is paragraph, math block,
 * paragraph): a backslash before that line, or after its closing line,
 * would show up literally and leave the block unclosed.
 */
import { displayFormulas, type SourceSpan } from './dollar-runs';
import type { SourceEdit } from './source-edits';

export interface LeafMath {
    /** Whole formulas, '$$' runs included */
    formulas: SourceSpan[];
    /** Newlines to leave as written: inside formulas and around block ones */
    untouchedNewlines: ReadonlySet<number>;
}

export const NO_MATH: LeafMath = { formulas: [], untouchedNewlines: new Set() };

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

/** The formulas of the leaf block source[start, end); `opaque` are its code spans */
export const leafMath = (
    source: string,
    start: number,
    end: number,
    opaque: readonly SourceSpan[]
): LeafMath => {
    const formulas: SourceSpan[] = [];
    const untouchedNewlines = new Set<number>();
    for (const { opener, closer } of displayFormulas(source, start, end, opaque)) {
        const closerEnd = closer.at + closer.length;
        formulas.push({ start: opener.at, end: closerEnd });
        for (let index = opener.at; index < closerEnd; index += 1) {
            if (source[index] === '\n') untouchedNewlines.add(index);
        }
        if (!startsLine(source, opener.at)) continue;
        const before = source.lastIndexOf('\n', opener.at - 1);
        if (before >= start) untouchedNewlines.add(before);
        if (!endsLine(source, closerEnd)) continue;
        const after = source.indexOf('\n', closerEnd);
        if (after !== -1 && after < end) untouchedNewlines.add(after);
    }
    return { formulas, untouchedNewlines };
};

/** Whether an edit would rewrite part of a formula */
export const touchesFormula = (math: LeafMath, edit: SourceEdit): boolean =>
    math.formulas.some((formula) => edit.start < formula.end && edit.end > formula.start);
