/**
 * Server-canonical styling rule: characters inside code/pre are not
 * stylable — Telegram strips formatting overlapping them. Split formatting
 * entities around code/pre spans up front so what we send (and preview) is
 * exactly what Telegram displays.
 */
import type { EntityType, MessageEntity } from '../types';

const FORMATTING: ReadonlySet<EntityType> = new Set([
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'spoiler',
]);

interface Span {
    start: number;
    end: number;
}

export const splitFormattingAroundOpaque = (
    entities: MessageEntity[]
): MessageEntity[] => {
    const opaque: Span[] = entities
        .filter((entity) => entity.type === 'code' || entity.type === 'pre')
        .map((entity) => ({ start: entity.offset, end: entity.offset + entity.length }))
        .sort((a, b) => a.start - b.start);

    if (opaque.length === 0) return entities;

    const result: MessageEntity[] = [];
    for (const entity of entities) {
        if (!FORMATTING.has(entity.type)) {
            result.push(entity);
            continue;
        }

        let cursor = entity.offset;
        const entityEnd = entity.offset + entity.length;
        for (const span of opaque) {
            if (span.end <= cursor || span.start >= entityEnd) continue;
            if (span.start > cursor) {
                result.push({ ...entity, offset: cursor, length: span.start - cursor });
            }
            cursor = Math.max(cursor, span.end);
        }
        if (cursor < entityEnd) {
            result.push({ ...entity, offset: cursor, length: entityEnd - cursor });
        }
    }

    return result;
};
