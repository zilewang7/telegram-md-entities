/**
 * Safety net for streaming repair: synthetic closers are appended at the
 * very end of the buffer, so if the parser refuses to pair some of them
 * (scanner/parser flanking disagreement on exotic input), their literal
 * remnant can only surface as a marker-character suffix of the rendered
 * text. Strip it and clamp entities — synthetic characters must never be
 * visible.
 */
import type { RenderedMessage } from '../types';
import { trimMessageEdges } from '../shared/trim-message';

const MARKER_CHARS = new Set(['*', '_', '~', '|', '`']);

export const stripSyntheticSuffix = (
    message: RenderedMessage,
    appendix: string
): RenderedMessage => {
    if (!appendix) return message;

    let end = message.text.length;
    let budget = appendix.length;
    while (budget > 0 && end > 0) {
        const char = message.text[end - 1];
        if (char === undefined || !MARKER_CHARS.has(char)) break;
        end -= 1;
        budget -= 1;
    }

    if (end === message.text.length) return message;

    const text = message.text.slice(0, end);
    const entities = message.entities
        .map((entity) => {
            const clampedEnd = Math.min(entity.offset + entity.length, text.length);
            return { ...entity, length: clampedEnd - entity.offset };
        })
        .filter((entity) => entity.length > 0 && entity.offset < text.length);

    return trimMessageEdges({ text, entities });
};
