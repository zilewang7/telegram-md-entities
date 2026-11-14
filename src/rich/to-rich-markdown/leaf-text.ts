/**
 * The text a reader sees in one leaf block (a paragraph, heading or table
 * cell) and where each literal text node starts in it, so a linker can be
 * told which characters sit right around its run: '**Alice**#3' gives the
 * run '#3' with 'e' before it, as 'Alice#3' reads. Mirrors what the
 * renderer shows (render/walker.ts, render/html-tags.ts).
 */
import type { Link, PhrasingContent, Text } from 'mdast';
import { match } from 'ts-pattern';
import { isKnownCloseTag, readOpenTag, tokenizeHtml } from '../../render/html-tags';
import { resolveLinkTarget } from '../../render/link-target';
import { plainTextOfNodes } from '../../render/plain-text';

export interface LeafText {
    text: string;
    runStarts: Map<Text, number>;
}

interface LeafTextState extends LeafText {
    /** Spoiler spans open so far: a '</span>' closes one, or shows when none is open */
    openSpoilerSpans: number;
}

/** What the renderer shows of an html node: tag pairing as in renderHtmlValue */
const visibleHtmlText = (value: string, leaf: LeafTextState): string =>
    tokenizeHtml(value)
        .map((token) => {
            if (token.kind === 'text') return token.value;
            if (token.name === 'br') return '\n';
            if (token.closing) {
                if (token.name !== 'span') return isKnownCloseTag(token.name) ? '' : token.raw;
                if (leaf.openSpoilerSpans === 0) return token.raw;
                leaf.openSpoilerSpans -= 1;
                return '';
            }
            const reading = readOpenTag(token.name, token.attrs);
            if (reading === 'literal') return token.raw;
            if (reading === 'spoiler-span' && !token.selfClosing) leaf.openSpoilerSpans += 1;
            return '';
        })
        .join('');

/** A link Telegram could not open shows its target after the label, as renderLink writes it */
const unresolvedLinkSuffix = (link: Link): string => {
    const label = plainTextOfNodes(link.children);
    const bareAutolink = [label, `http://${label}`, `https://${label}`, `mailto:${label}`].includes(link.url);
    if (bareAutolink || link.url === '' || resolveLinkTarget(link.url) !== null) return '';
    return ` (${link.url})`;
};

const appendVisible = (nodes: readonly PhrasingContent[], leaf: LeafTextState): void => {
    for (const node of nodes) {
        match(node)
            .with({ type: 'text' }, (text) => {
                leaf.runStarts.set(text, leaf.text.length);
                leaf.text += text.value;
            })
            .with({ type: 'inlineCode' }, (code) => {
                leaf.text += code.value;
            })
            .with({ type: 'break' }, () => {
                leaf.text += '\n';
            })
            .with({ type: 'html' }, (html) => {
                leaf.text += visibleHtmlText(html.value, leaf);
            })
            .with({ type: 'image' }, (image) => {
                leaf.text += image.alt || image.url;
            })
            .with({ type: 'imageReference' }, (image) => {
                leaf.text += image.alt ?? '';
            })
            .with({ type: 'link' }, (link) => {
                appendVisible(link.children, leaf);
                leaf.text += unresolvedLinkSuffix(link);
            })
            .with({ type: 'footnoteReference' }, (reference) => {
                leaf.text += `[${reference.identifier}]`;
            })
            .otherwise((other) => {
                if ('children' in other) appendVisible(other.children, leaf);
            });
    }
};

export const leafTextOf = (nodes: readonly PhrasingContent[]): LeafText => {
    const leaf: LeafTextState = { text: '', runStarts: new Map(), openSpoilerSpans: 0 };
    appendVisible(nodes, leaf);
    return { text: leaf.text, runStarts: leaf.runStarts };
};

/** What a reader sees right before and right after a run: one character each, '' at the block's edge */
export interface RunNeighbours {
    before: string;
    after: string;
}

const NO_NEIGHBOURS: RunNeighbours = { before: '', after: '' };

export const runNeighboursOf = (leaf: LeafText | null, run: Text): RunNeighbours => {
    const start = leaf?.runStarts.get(run);
    if (leaf === null || start === undefined) return NO_NEIGHBOURS;
    const end = start + run.value.length;
    // Two code units hold one character either way
    const before = Array.from(leaf.text.slice(Math.max(0, start - 2), start)).at(-1) ?? '';
    const after = Array.from(leaf.text.slice(end, end + 2))[0] ?? '';
    return { before, after };
};
