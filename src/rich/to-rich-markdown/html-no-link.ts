/**
 * Inline HTML elements whose text must not get a link: <a> (a link
 * already), <code> and <pre> (code). mdast gives the open tag, the text and
 * the close tag of a paragraph's raw HTML as separate nodes, so the walk
 * counts, per leaf block, the ones still open.
 */
import { tokenizeHtml } from '../../render/html-tags';

const NO_LINK_ELEMENTS = ['a', 'code', 'pre'] as const;

type NoLinkElement = (typeof NO_LINK_ELEMENTS)[number];

const isNoLinkElement = (name: string): name is NoLinkElement =>
    NO_LINK_ELEMENTS.some((element) => element === name);

/** How many of each are open in the current leaf block */
export type NoLinkElements = Map<NoLinkElement, number>;

export const noLinkElementsNone = (): NoLinkElements => new Map();

/** Count the tags of one inline html node's value into `open` */
export const countNoLinkTags = (value: string, open: NoLinkElements): void => {
    for (const token of tokenizeHtml(value)) {
        if (token.kind !== 'tag' || !isNoLinkElement(token.name)) continue;
        const depth = open.get(token.name) ?? 0;
        if (token.closing) open.set(token.name, Math.max(0, depth - 1));
        else if (!token.selfClosing) open.set(token.name, depth + 1);
    }
};

export const insideNoLinkElement = (open: NoLinkElements): boolean => [...open.values()].some((depth) => depth > 0);
