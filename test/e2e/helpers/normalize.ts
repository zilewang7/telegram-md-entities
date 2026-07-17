/**
 * Both-sides normalizer for round-trip comparison. Applied to OUR render
 * and to the server's response alike; every rule documents an observed
 * server normalization, making this file a living record of Bot API
 * behavior.
 */
import type { EntityType, MessageEntity, RenderedMessage } from '../../../src/types';
import type { TgMessageLite } from './client';

/** Entity types we emit; the server also annotates url/mention/hashtag/etc.
 *  on the response — those are auto-detections, not part of the round-trip */
const OUR_TYPES = new Set<string>([
    'bold', 'italic', 'underline', 'strikethrough', 'spoiler',
    'code', 'pre', 'text_link', 'blockquote', 'expandable_blockquote',
]);

const isOurType = (value: string): value is EntityType => OUR_TYPES.has(value);

export const fromResponse = (message: TgMessageLite): RenderedMessage => {
    const entities: MessageEntity[] = [];
    for (const raw of message.entities ?? []) {
        const type = typeof raw.type === 'string' ? raw.type : '';
        if (!isOurType(type)) continue;
        entities.push({
            type,
            offset: typeof raw.offset === 'number' ? raw.offset : 0,
            length: typeof raw.length === 'number' ? raw.length : 0,
            ...(typeof raw.url === 'string' ? { url: raw.url } : {}),
            ...(typeof raw.language === 'string' ? { language: raw.language } : {}),
        });
    }
    return { text: message.text ?? '', entities };
};

export { styleSegments } from '../../../src/rich/style-segments';
export type { StyleSegment } from '../../../src/rich/style-segments';
import { styleSegments } from '../../../src/rich/style-segments';
import type { StyleSegment } from '../../../src/rich/style-segments';

export const normalizeForCompare = (message: RenderedMessage): StyleSegment[] =>
    styleSegments(message);
