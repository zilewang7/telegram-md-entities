/**
 * Both-sides normalizer for round-trip comparison. Applied to OUR render
 * and to the server's response alike; every rule documents an observed
 * server normalization, making this file a living record of Bot API
 * behavior.
 */
import { normalizeEntities } from '../../../src/render/normalize-entities';
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

export interface StyleSegment {
    text: string;
    styles: string[];
}

/**
 * Display-equivalent canonical form: per-character style sets, RLE-compressed
 * into segments. The server freely splits/merges entities in its internal
 * representation (e.g. italic containing bold becomes two italics); what is
 * invariant is which styles cover each character — so THAT is what we
 * compare. Also robust to trailing-slash url normalization.
 */
export const styleSegments = (message: RenderedMessage): StyleSegment[] => {
    const { text, entities } = message;
    const styleAt: string[][] = Array.from({ length: text.length }, () => []);

    for (const entity of normalizeEntities(entities)) {
        const atom =
            entity.type +
            (entity.url !== undefined ? `:${entity.url.replace(/\/$/, '')}` : '') +
            (entity.language !== undefined ? `:${entity.language}` : '');
        const end = Math.min(entity.offset + entity.length, text.length);
        for (let i = Math.max(0, entity.offset); i < end; i++) {
            styleAt[i]?.push(atom);
        }
    }

    const segments: StyleSegment[] = [];
    for (let i = 0; i < text.length; i++) {
        const styles = [...(styleAt[i] ?? [])].sort();
        const key = styles.join('|');
        const previous = segments[segments.length - 1];
        if (previous && previous.styles.join('|') === key) {
            previous.text += text[i] ?? '';
        } else {
            segments.push({ text: text[i] ?? '', styles });
        }
    }
    return segments;
};

export const normalizeForCompare = (message: RenderedMessage): StyleSegment[] =>
    styleSegments(message);
