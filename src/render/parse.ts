/**
 * Markdown → mdast parsing. Uses mdast-util-from-markdown + GFM directly
 * (no unified/remark facade): smaller dependency surface, we only consume
 * the AST. Note micromark-extension-gfm is only the syntax (tokenizer)
 * layer — mdast-util-gfm's fromMarkdown extension is what actually
 * materializes tables/strikethrough/tasklists as mdast nodes.
 */
import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { spoilerFromMarkdown } from './spoiler/mdast-spoiler';
import { spoilerSyntax } from './spoiler/micromark-spoiler';

export interface ParseOptions {
    /** Enable the ||spoiler|| dialect */
    spoiler: boolean;
}

export const parseMarkdown = (markdown: string, options: ParseOptions): Root => {
    return fromMarkdown(markdown, {
        extensions: [gfm(), ...(options.spoiler ? [spoilerSyntax()] : [])],
        mdastExtensions: [
            gfmFromMarkdown(),
            ...(options.spoiler ? [spoilerFromMarkdown()] : []),
        ],
    });
};
