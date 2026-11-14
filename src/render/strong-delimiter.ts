/**
 * Telegram MarkdownV2 dialect: '__text__' means underline, '**text**' bold.
 * mdast strong doesn't record its delimiter, so read it back off the source.
 * Shared by the renderer and the rich-markdown rewrite so the two always
 * agree on which strong is an underline.
 */
import type { Strong } from 'mdast';

export const isUnderscoreStrong = (node: Strong, source: string): boolean => {
    const offset = node.position?.start.offset;
    return offset !== undefined && source[offset] === '_';
};
