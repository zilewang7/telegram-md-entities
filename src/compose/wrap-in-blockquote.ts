/**
 * Wrap a rendered message in a (expandable) blockquote entity — e.g. for
 * LLM "thinking" sections.
 *
 * A quote only renders inline entities. Nesting a block entity in one breaks
 * the quote on the client side: the client stops rendering the quote at the
 * first nested `pre`, and a quote that *starts* with one is dropped entirely,
 * so the quoted text leaks into the message body as plain text (observed
 * 2026-09-14 with a Gemini CoT whose 4-space-indented bullets parsed as an
 * indented code block). Inner block entities are therefore flattened — the
 * entity is dropped, its text stays. Same reason inner quotes are stripped.
 */
import type { EntityType, RenderedMessage } from '../types';
import { normalizeEntities } from '../render/normalize-entities';

/** Entity types Telegram renders as blocks — nothing may nest inside a quote */
const BLOCK_ENTITY_TYPES: ReadonlySet<EntityType> = new Set([
    'pre',
    'blockquote',
    'expandable_blockquote',
]);

/** Drop block entities, keeping their text: the only shapes a quote can hold */
export const withoutBlockEntities = (message: RenderedMessage): RenderedMessage => ({
    text: message.text,
    entities: message.entities.filter((entity) => !BLOCK_ENTITY_TYPES.has(entity.type)),
});

export const wrapInBlockquote = (
    message: RenderedMessage,
    expandable: boolean = false
): RenderedMessage => {
    if (!message.text) return message;

    return {
        text: message.text,
        entities: normalizeEntities([
            {
                type: expandable ? 'expandable_blockquote' : 'blockquote',
                offset: 0,
                length: message.text.length,
            },
            ...withoutBlockEntities(message).entities,
        ]),
    };
};
