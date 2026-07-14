/**
 * Split a rendered message's text and entities at a cut position. Entities
 * spanning the cut are closed in the head and reopened at the start of the
 * tail — formatting continues seamlessly across messages (pre keeps its
 * language on both halves, so split code blocks stay highlighted).
 */
import type { MessageEntity, RenderedMessage } from '../types';

export interface ClippedMessage {
    head: RenderedMessage;
    tail: RenderedMessage;
}

export const clipEntitiesAt = (
    message: RenderedMessage,
    cut: number
): ClippedMessage => {
    const headEntities: MessageEntity[] = [];
    const tailEntities: MessageEntity[] = [];

    for (const entity of message.entities) {
        const end = entity.offset + entity.length;
        if (end <= cut) {
            headEntities.push(entity);
        } else if (entity.offset >= cut) {
            tailEntities.push({ ...entity, offset: entity.offset - cut });
        } else {
            headEntities.push({ ...entity, length: cut - entity.offset });
            tailEntities.push({ ...entity, offset: 0, length: end - cut });
        }
    }

    return {
        head: {
            text: message.text.slice(0, cut),
            entities: headEntities.filter((entity) => entity.length > 0),
        },
        tail: {
            text: message.text.slice(cut),
            entities: tailEntities.filter((entity) => entity.length > 0),
        },
    };
};
