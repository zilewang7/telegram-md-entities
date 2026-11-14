/**
 * The '$' runs of a text node, as Telegram's math syntax sees them: a
 * single '$' delimits inline math, a '$$' run display math. Escaped '\$'
 * is not a delimiter.
 */

export interface DollarRun {
    /** Source offset of the first '$' */
    at: number;
    length: number;
}

/** A '$$…$$' formula: a '$$' run and the next one */
export interface DisplayFormula {
    opener: DollarRun;
    closer: DollarRun;
}

const isAsciiPunctuation = (char: string | undefined): boolean =>
    char !== undefined && /[!-/:-@[-`{-~]/.test(char);

/** The unescaped '$' runs in source[start, end), in order */
export const dollarRuns = (source: string, start: number, end: number): DollarRun[] => {
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
 * The '$$…$$' formulas in source[start, end): every '$$' run paired with
 * the next one, in order. An unpaired last run opens nothing.
 */
export const displayFormulas = (source: string, start: number, end: number): DisplayFormula[] => {
    const doubles = dollarRuns(source, start, end).filter((run) => run.length === 2);
    const formulas: DisplayFormula[] = [];
    for (let index = 0; index + 1 < doubles.length; index += 2) {
        const opener = doubles[index];
        const closer = doubles[index + 1];
        if (opener && closer) formulas.push({ opener, closer });
    }
    return formulas;
};
