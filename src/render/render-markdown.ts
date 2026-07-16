/**
 * renderMarkdown: lenient LLM markdown → { text, entities } for the Bot API.
 */
import type { RenderOptions, RenderedMessage } from '../types';
import { DEFAULT_HR_TEXT } from '../constants';
import { repairTail } from '../streaming/repair-tail';
import { stripSyntheticSuffix } from '../streaming/strip-synthetic';
import { createEmitter } from './emitter';
import { normalizeEntities } from './normalize-entities';
import { splitFormattingAroundOpaque } from './split-around-opaque';
import { parseMarkdown } from './parse';
import { walkBlocks, type WalkOptions } from './walker';

const resolveOptions = (options?: RenderOptions): WalkOptions => ({
    streaming: options?.streaming ?? false,
    table: options?.table ?? 'auto',
    heading: options?.heading ?? 'bold',
    hrText: options?.hrText ?? DEFAULT_HR_TEXT,
    spoiler: options?.spoiler ?? true,
    spoilerMode: options?.spoilerMode ?? 'loose',
    underline: options?.underline ?? true,
    linkifyBareUrls: options?.linkifyBareUrls ?? false,
});

export const renderMarkdown = (
    markdown: string,
    options?: RenderOptions
): RenderedMessage => {
    const resolved = resolveOptions(options);

    // Streaming: repair the unclosed tail so in-progress constructs render
    // as their intended formatting; a complete document passes through
    // untouched, so streaming output converges with the strict render
    const repair = resolved.streaming
        ? repairTail(markdown, { spoilerMode: resolved.spoilerMode })
        : null;
    const source = repair ? repair.repaired : markdown;

    const root = parseMarkdown(source, {
        spoiler: resolved.spoiler,
        spoilerMode: resolved.spoilerMode,
    });
    const emitter = createEmitter();
    walkBlocks(root.children, {
        emitter,
        options: resolved,
        source,
        quoteDepth: 0,
        listDepth: 0,
    }, '\n\n');

    const { text, entities } = emitter.finish();
    const rendered = {
        text,
        entities: normalizeEntities(splitFormattingAroundOpaque(entities)),
    };

    if (repair && repair.appendix) {
        const stripped = stripSyntheticSuffix(rendered, repair.appendix);
        return { text: stripped.text, entities: normalizeEntities(stripped.entities) };
    }
    return rendered;
};
