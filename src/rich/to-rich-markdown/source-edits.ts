/**
 * In-place source rewriting: a list of replacements at source offsets,
 * applied in one pass. Every byte outside the replaced ranges is kept,
 * which is what makes the rich-markdown rewrite a rewrite and not a
 * re-serialisation.
 */

export interface SourceEdit {
    /** Replaced range [start, end) in the source the edit was collected on */
    start: number;
    end: number;
    text: string;
}

/** Maps an offset of an inner string (an html value, a fragment) to the outer source */
export type OffsetMap = (offset: number) => number | undefined;

/**
 * Move edits collected on an inner string into the outer source. An edit
 * whose characters are not contiguous in the outer source (a container
 * prefix or a <br> replacement inside the range) is dropped: leaving those
 * bytes alone is always safe, replacing them could break the structure.
 */
export const mapEdits = (edits: readonly SourceEdit[], map: OffsetMap): SourceEdit[] => {
    const mapped: SourceEdit[] = [];
    for (const edit of edits) {
        const start = map(edit.start);
        const last = map(edit.end - 1);
        if (start === undefined || last === undefined) continue;
        if (last - start !== edit.end - 1 - edit.start) continue;
        mapped.push({ start, end: last + 1, text: edit.text });
    }
    return mapped;
};

export const shiftEdits = (edits: readonly SourceEdit[], base: number): SourceEdit[] =>
    edits.map((edit) => ({ start: edit.start + base, end: edit.end + base, text: edit.text }));

/** Apply edits left to right; an edit overlapping an earlier one is skipped */
export const applySourceEdits = (source: string, edits: readonly SourceEdit[]): string => {
    const ordered = [...edits]
        .filter((edit) => edit.start < edit.end)
        .sort((left, right) => left.start - right.start || left.end - right.end);
    let output = '';
    let cursor = 0;
    for (const edit of ordered) {
        if (edit.start < cursor) continue;
        output += source.slice(cursor, edit.start) + edit.text;
        cursor = edit.end;
    }
    return output + source.slice(cursor);
};
