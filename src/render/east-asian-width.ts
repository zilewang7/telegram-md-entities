/**
 * Simplified East_Asian_Width: display width of a string where Wide/Fullwidth
 * code points (CJK, Hangul, Kana, fullwidth forms, emoji) count as 2 columns.
 * Used to align table columns inside monospace pre blocks so Chinese tables
 * line up; a compact range table beats a Unicode-data dependency here.
 */

const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
    [0x1100, 0x115f], // Hangul Jamo
    [0x2e80, 0x303e], // CJK Radicals .. CJK Symbols and Punctuation
    [0x3041, 0x33ff], // Hiragana .. CJK Compatibility
    [0x3400, 0x4dbf], // CJK Extension A
    [0x4e00, 0x9fff], // CJK Unified Ideographs
    [0xa000, 0xa4cf], // Yi
    [0xac00, 0xd7a3], // Hangul Syllables
    [0xf900, 0xfaff], // CJK Compatibility Ideographs
    [0xfe30, 0xfe4f], // CJK Compatibility Forms
    [0xff00, 0xff60], // Fullwidth Forms
    [0xffe0, 0xffe6], // Fullwidth Signs
    [0x1f300, 0x1f64f], // Emoji & pictographs
    [0x1f900, 0x1f9ff], // Supplemental symbols & pictographs
    [0x20000, 0x2fffd], // CJK Extension B..F
    [0x30000, 0x3fffd], // CJK Extension G
];

const isWide = (codePoint: number): boolean => {
    for (const [start, end] of WIDE_RANGES) {
        if (codePoint >= start && codePoint <= end) return true;
        if (codePoint < start) return false; // ranges are sorted
    }
    return false;
};

export const displayWidth = (value: string): number => {
    let width = 0;
    for (const char of value) {
        const codePoint = char.codePointAt(0);
        width += codePoint !== undefined && isWide(codePoint) ? 2 : 1;
    }
    return width;
};

/** First code point is East Asian Wide (CJK ideographs, kana, fullwidth…) */
export const isWideChar = (char: string): boolean => {
    const codePoint = char.codePointAt(0);
    return codePoint !== undefined && isWide(codePoint);
};
