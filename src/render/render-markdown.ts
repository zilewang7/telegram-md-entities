/**
 * renderMarkdown: lenient LLM markdown → { text, entities } for the Bot API.
 */
import type { RenderOptions, RenderedMessage } from '../types';
import { DEFAULT_HR_TEXT } from '../constants';
import { createEmitter } from './emitter';
import { normalizeEntities } from './normalize-entities';
import { parseMarkdown } from './parse';
import { walkBlocks, type WalkOptions } from './walker';

interface ResolvedRenderOptions extends WalkOptions {
    streaming: boolean;
    spoiler: boolean;
}

const resolveOptions = (options?: RenderOptions): ResolvedRenderOptions => ({
    streaming: options?.streaming ?? false,
    table: options?.table ?? 'pre',
    heading: options?.heading ?? 'bold',
    hrText: options?.hrText ?? DEFAULT_HR_TEXT,
    spoiler: options?.spoiler ?? true,
    linkifyBareUrls: options?.linkifyBareUrls ?? false,
});

export const renderMarkdown = (
    markdown: string,
    options?: RenderOptions
): RenderedMessage => {
    const resolved = resolveOptions(options);

    const root = parseMarkdown(markdown, { spoiler: resolved.spoiler });
    const emitter = createEmitter();
    walkBlocks(root.children, {
        emitter,
        options: resolved,
        quoteDepth: 0,
        listDepth: 0,
    }, '\n\n');

    const { text, entities } = emitter.finish();
    return { text, entities: normalizeEntities(entities) };
};
