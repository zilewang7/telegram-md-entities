/**
 * Wrap a rendered message in a (expandable) blockquote entity — e.g. for
 * LLM "thinking" sections. Inner blockquotes are stripped first (Telegram
 * quotes cannot nest).
 */
import type { RenderedMessage } from '../types';
import { normalizeEntities } from '../render/normalize-entities';

export const wrapInBlockquote = (
    message: RenderedMessage,
    expandable: boolean = false
): RenderedMessage => {
    if (!message.text) return message;

    const inner = message.entities.filter(
        (entity) =>
            entity.type !== 'blockquote' && entity.type !== 'expandable_blockquote'
    );

    return {
        text: message.text,
        entities: normalizeEntities([
            {
                type: expandable ? 'expandable_blockquote' : 'blockquote',
                offset: 0,
                length: message.text.length,
            },
            ...inner,
        ]),
    };
};
