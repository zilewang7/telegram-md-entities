/**
 * Concatenate rendered messages (and plain-string separators) with correct
 * entity re-offsetting. Callers compose thinking blocks, headers and bodies
 * without touching offsets by hand.
 */
import type { MessageEntity, RenderedMessage } from '../types';
import { normalizeEntities } from '../render/normalize-entities';

export const concatMessages = (
    ...parts: Array<RenderedMessage | string>
): RenderedMessage => {
    let text = '';
    const entities: MessageEntity[] = [];

    for (const part of parts) {
        if (typeof part === 'string') {
            text += part;
            continue;
        }
        const base = text.length;
        text += part.text;
        for (const entity of part.entities) {
            entities.push({ ...entity, offset: entity.offset + base });
        }
    }

    return { text, entities: normalizeEntities(entities) };
};
