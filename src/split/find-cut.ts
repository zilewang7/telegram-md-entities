/**
 * Cut-position search for message splitting. Boundary QUALITY beats
 * proximity: a paragraph break / newline anywhere past the floor wins over
 * sentence/comma boundaries near the limit — never break mid-sentence just
 * to pack a few more characters (policy battle-tested in k-on-bot).
 */

const SENTENCE_ENDINGS = new Set(['。', '！', '？', '；', '!', '?', ';', '.']);
const WEAK_BOUNDARIES = new Set([' ', '，', ',', '、']);

/** Sentence/weak boundaries only count in the last quarter before the cut */
const BOUNDARY_WINDOW_RATIO = 0.75;
/** Paragraph/newline boundaries count anywhere past this ratio */
const NEWLINE_FLOOR_RATIO = 0.25;

/** Step back one unit if pos would land between the halves of a surrogate pair */
export const clampSurrogate = (text: string, pos: number): number => {
    if (
        pos > 0 &&
        pos < text.length &&
        (text.charCodeAt(pos - 1) & 0xfc00) === 0xd800 &&
        (text.charCodeAt(pos) & 0xfc00) === 0xdc00
    ) {
        return pos - 1;
    }
    return pos;
};

const searchCharSetBackwards = (
    text: string,
    chars: ReadonlySet<string>,
    from: number,
    to: number
): number => {
    for (let i = to - 1; i >= from; i--) {
        const char = text[i];
        if (char !== undefined && chars.has(char)) return i + 1;
    }
    return -1;
};

/**
 * Choose a cut position in (0, hardCut]. `hardCut` already honors all
 * budgets (length, entity count, text length); this only improves the
 * boundary quality of the cut.
 */
export const findCutPosition = (text: string, hardCut: number): number => {
    const floor = Math.max(1, Math.floor(hardCut * NEWLINE_FLOOR_RATIO));
    const windowStart = Math.max(floor, Math.floor(hardCut * BOUNDARY_WINDOW_RATIO));

    // Paragraph break anywhere in [floor, hardCut)
    const paragraph = text.lastIndexOf('\n\n', hardCut - 2);
    if (paragraph >= floor && paragraph + 2 <= hardCut) return paragraph + 2;

    // Single newline anywhere in [floor, hardCut)
    const newline = text.lastIndexOf('\n', hardCut - 1);
    if (newline >= floor && newline + 1 <= hardCut) return newline + 1;

    // Sentence endings, then weak boundaries, near the limit only
    const sentence = searchCharSetBackwards(text, SENTENCE_ENDINGS, windowStart, hardCut);
    if (sentence >= 0) return sentence;

    const weak = searchCharSetBackwards(text, WEAK_BOUNDARIES, windowStart, hardCut);
    if (weak >= 0) return weak;

    return clampSurrogate(text, hardCut);
};
