/**
 * Inline tail scan: walks the current leaf block left→right, tracking
 * constructs still open at EOF, using CommonMark flanking rules (EOF counts
 * as whitespace). Pairing here is approximate — the appended closers are
 * re-adjudicated by the real parser, which is what guarantees correctness.
 *
 * Half-written links (`[label](partial-ur`) are SPLICED out instead of
 * closed: the label stays visible, no entity carries a broken URL.
 */

export interface OpenInline {
    marker: '*' | '_' | '~~' | '||' | '`';
    size: number;
}

export interface InlineTailScan {
    /** Buffer with half-link syntax removed (label kept) */
    splicedBuffer: string;
    /** Constructs open at EOF, outermost first */
    openStack: OpenInline[];
}

const isWhitespace = (char: string): boolean => char === '' || /\s/u.test(char);
const isPunctuation = (char: string): boolean =>
    char !== '' && /[\p{P}\p{S}]/u.test(char);

interface Flanking {
    canOpen: boolean;
    canClose: boolean;
}

/** CommonMark delimiter-run flanking; '' stands for start/end of text */
const classifyRun = (marker: '*' | '_', before: string, after: string): Flanking => {
    const leftFlanking =
        !isWhitespace(after) && (!isPunctuation(after) || isWhitespace(before) || isPunctuation(before));
    const rightFlanking =
        !isWhitespace(before) && (!isPunctuation(before) || isWhitespace(after) || isPunctuation(after));

    if (marker === '*') {
        return { canOpen: leftFlanking, canClose: rightFlanking };
    }
    // '_' forbids intraword emphasis
    return {
        canOpen: leftFlanking && (!rightFlanking || isPunctuation(before)),
        canClose: rightFlanking && (!leftFlanking || isPunctuation(after)),
    };
};

/** Two-class flanking for ~~ and || (mirrors gfm-strikethrough) */
const classifyToggle = (before: string, after: string): Flanking => {
    const beforeClass = isWhitespace(before) ? 1 : isPunctuation(before) ? 2 : 0;
    const afterClass = isWhitespace(after) ? 1 : isPunctuation(after) ? 2 : 0;
    return {
        canOpen: afterClass === 0 || (afterClass === 2 && beforeClass !== 0),
        canClose: beforeClass === 0 || (beforeClass === 2 && afterClass !== 0),
    };
};

interface LinkCandidate {
    /** Raw index of '[' (or '!' for images) in the (spliced) buffer */
    start: number;
    isImage: boolean;
    /** Raw index of the '](' once seen, else -1 */
    urlStart: number;
}

export const scanInlineTail = (buffer: string, regionStart: number): InlineTailScan => {
    let text = buffer;
    const stack: OpenInline[] = [];
    const links: LinkCandidate[] = [];
    let openCode: number | null = null; // backtick run size when a code span is open

    let i = Math.max(0, Math.min(regionStart, text.length));

    const runLength = (index: number, char: string): number => {
        let length = 0;
        while (text[index + length] === char) length += 1;
        return length;
    };

    while (i < text.length) {
        const char = text[i];
        if (char === undefined) break;

        if (char === '\\') {
            i += 2;
            continue;
        }

        if (char === '`') {
            const size = runLength(i, '`');
            if (openCode === size) {
                openCode = null;
            } else if (openCode === null) {
                openCode = size;
            }
            i += size;
            continue;
        }

        if (openCode !== null) {
            i += 1;
            continue;
        }

        if (char === '*' || char === '_') {
            const size = runLength(i, char);
            const before = text[i - 1] ?? '';
            const after = text[i + size] ?? '';
            const { canOpen, canClose } = classifyRun(char, before, after);

            if (canClose) {
                // Consume against open runs of the same marker, innermost first
                let remaining = size;
                while (remaining > 0) {
                    const top = stack[stack.length - 1];
                    if (!top || top.marker !== char) break;
                    const used = Math.min(top.size, remaining);
                    top.size -= used;
                    remaining -= used;
                    if (top.size === 0) stack.pop();
                }
                if (remaining > 0 && canOpen) {
                    stack.push({ marker: char, size: remaining });
                }
            } else if (canOpen) {
                stack.push({ marker: char, size });
            }
            i += size;
            continue;
        }

        if (char === '~' || char === '|') {
            const size = runLength(i, char);
            if (size === 2) {
                const marker: '~~' | '||' = char === '~' ? '~~' : '||';
                const before = text[i - 1] ?? '';
                const after = text[i + size] ?? '';
                const { canOpen, canClose } = classifyToggle(before, after);
                const openIndex = stack.findIndex((entry) => entry.marker === marker);
                if (canClose && openIndex >= 0) {
                    stack.splice(openIndex, stack.length - openIndex);
                } else if (canOpen && openIndex < 0) {
                    stack.push({ marker, size: 2 });
                }
            }
            i += size;
            continue;
        }

        if (char === '[') {
            const isImage = text[i - 1] === '!';
            links.push({ start: isImage ? i - 1 : i, isImage, urlStart: -1 });
            i += 1;
            continue;
        }

        if (char === ']') {
            const candidate = links[links.length - 1];
            if (candidate) {
                if (text[i + 1] === '(') {
                    candidate.urlStart = i;
                    // Skip through the URL part; a ')' completes the link
                    let j = i + 2;
                    let depth = 0;
                    while (j < text.length) {
                        const urlChar = text[j];
                        if (urlChar === '\\') j += 1;
                        else if (urlChar === '(') depth += 1;
                        else if (urlChar === ')') {
                            if (depth === 0) break;
                            depth -= 1;
                        }
                        j += 1;
                    }
                    if (j < text.length) {
                        links.pop(); // completed link
                        i = j + 1;
                        continue;
                    }
                    // Unterminated URL at EOF: splice out '[' .. and '](...' tail
                    const label = text.slice(candidate.start + (candidate.isImage ? 2 : 1), i);
                    text = text.slice(0, candidate.start) + label;
                    links.pop();
                    i = text.length;
                    continue;
                }
                links.pop(); // plain '[label]' — leave literal
            }
            i += 1;
            continue;
        }

        i += 1;
    }

    // Unclosed code span: everything inside is literal — repair only the span
    if (openCode !== null) {
        return { splicedBuffer: text, openStack: [{ marker: '`', size: openCode }] };
    }

    return { splicedBuffer: text, openStack: stack };
};
