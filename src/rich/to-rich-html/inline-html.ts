/**
 * Inline part of toRichHtml: text plus inline entities → HTML. Entities are
 * flattened into per-character style runs and rebuilt as strictly nested
 * tags (close and reopen where they overlap), the same technique
 * entitiesToMarkdown uses. Newlines become <br>, so the HTML of a paragraph
 * or quote never spans a blank line.
 */
import type { MessageEntity } from '../../types';
import { escapeHtmlAttribute, flowingTextHtml } from './escape-html';

type InlineStyle = 'text_link' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler' | 'code';

interface StyleAtom {
    key: string;
    style: InlineStyle;
    url?: string;
}

/** Outer → inner nesting order when several styles open at once */
const STYLE_ORDER: Record<InlineStyle, number> = {
    text_link: 0,
    bold: 1,
    italic: 2,
    underline: 3,
    strikethrough: 4,
    spoiler: 5,
    code: 6,
};

const TAG_NAMES: Record<Exclude<InlineStyle, 'text_link'>, string> = {
    bold: 'b',
    italic: 'i',
    underline: 'u',
    strikethrough: 's',
    spoiler: 'tg-spoiler',
    code: 'code',
};

/** Inline reading of an entity; a nested pre (inside a quote) reads as code */
const toAtom = (entity: MessageEntity): StyleAtom | undefined => {
    switch (entity.type) {
        case 'bold':
        case 'italic':
        case 'underline':
        case 'strikethrough':
        case 'spoiler':
        case 'code':
            return { key: entity.type, style: entity.type };
        case 'pre':
            return { key: 'code', style: 'code' };
        case 'text_link':
            return entity.url === undefined
                ? undefined
                : { key: `text_link:${entity.url}`, style: 'text_link', url: entity.url };
        default:
            return undefined;
    }
};

const openTag = (atom: StyleAtom): string =>
    atom.style === 'text_link'
        ? `<a href="${escapeHtmlAttribute(atom.url ?? '')}">`
        : `<${TAG_NAMES[atom.style]}>`;

const closeTag = (atom: StyleAtom): string =>
    atom.style === 'text_link' ? '</a>' : `</${TAG_NAMES[atom.style]}>`;

interface Run {
    /** text[start, end) */
    start: number;
    end: number;
    atoms: StyleAtom[];
}

/** Per-character style sets, run-length compressed */
const toRuns = (text: string, entities: readonly MessageEntity[]): Run[] => {
    const atomsAt: Map<string, StyleAtom>[] = Array.from({ length: text.length }, () => new Map());
    for (const entity of entities) {
        const atom = toAtom(entity);
        if (!atom) continue;
        const end = Math.min(text.length, entity.offset + entity.length);
        for (let index = Math.max(0, entity.offset); index < end; index += 1) {
            atomsAt[index]?.set(atom.key, atom);
        }
    }
    const runs: Run[] = [];
    let previousKey: string | undefined;
    for (let index = 0; index < text.length; index += 1) {
        // A line break inside code closes and reopens it around the <br>
        const isNewline = text[index] === '\n';
        const atoms = [...(atomsAt[index]?.values() ?? [])]
            .filter((atom) => !(isNewline && atom.style === 'code'))
            .sort(
            (left, right) =>
                STYLE_ORDER[left.style] - STYLE_ORDER[right.style] || left.key.localeCompare(right.key)
        );
        const key = atoms.map((atom) => atom.key).join('\u0000');
        const last = runs[runs.length - 1];
        if (last && key === previousKey) {
            last.end = index + 1;
        } else {
            runs.push({ start: index, end: index + 1, atoms });
        }
        previousKey = key;
    }
    return runs;
};

/**
 * Render text whose entities are already clipped to it (offsets relative
 * to text) as inline HTML.
 */
export const renderInlineHtml = (text: string, entities: readonly MessageEntity[]): string => {
    const output: string[] = [];
    const stack: StyleAtom[] = [];
    // Escaped over the whole text: a space's form depends on what precedes it
    const charsHtml = flowingTextHtml(text);
    const closeTo = (depth: number): void => {
        while (stack.length > depth) {
            const atom = stack.pop();
            if (atom) output.push(closeTag(atom));
        }
    };

    for (const run of toRuns(text, entities)) {
        // Keep the longest open prefix that the run still wants, in order
        let keep = 0;
        while (keep < stack.length && keep < run.atoms.length && stack[keep]?.key === run.atoms[keep]?.key) {
            keep += 1;
        }
        closeTo(keep);
        for (const atom of run.atoms.slice(keep)) {
            output.push(openTag(atom));
            stack.push(atom);
        }
        output.push(charsHtml.slice(run.start, run.end).join(''));
    }
    closeTo(0);
    return output.join('');
};
