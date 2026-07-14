/**
 * Trim edge whitespace off a rendered message, shifting/clamping entity
 * offsets to match. Telegram server-trims message edges; emitting untrimmed
 * text would silently desync every offset.
 */
import type { RenderedMessage } from '../types';

export const trimMessageEdges = (message: RenderedMessage): RenderedMessage => {
    const { text, entities } = message;
    const lead = text.match(/^\s+/)?.[0].length ?? 0;
    const body = text.replace(/\s+$/, '').slice(lead);

    if (body.length === text.length) return message;

    const adjusted = entities
        .map((entity) => {
            const start = Math.max(entity.offset - lead, 0);
            const end = Math.min(entity.offset + entity.length - lead, body.length);
            return { ...entity, offset: start, length: end - start };
        })
        .filter((entity) => entity.length > 0);

    return { text: body, entities: adjusted };
};
