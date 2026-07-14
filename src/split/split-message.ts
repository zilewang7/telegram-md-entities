/**
 * Dual-budget message splitter: every chunk fits BOTH maxLength (UTF-16)
 * and maxEntities. The entity budget collapses into a cut ceiling — with
 * entities sorted by offset, chunk-1's entity count is monotinically
 * non-decreasing in the cut position, so cutting before the
 * (maxEntities+1)-th entity's start bounds the count; the boundary-quality
 * search then runs below that ceiling unchanged.
 */
import type { MessageEntity, RenderedMessage, SplitOptions } from '../types';
import { DEFAULT_MAX_ENTITIES, DEFAULT_MAX_LENGTH } from '../constants';
import { normalizeEntities } from '../render/normalize-entities';
import { trimMessageEdges } from '../shared/trim-message';
import { clipEntitiesAt } from './clip-entities';
import { clampSurrogate, findCutPosition } from './find-cut';

const NEWLINE_FLOOR_RATIO = 0.25;

/**
 * A cut strictly inside a pre entity: prefer moving it back to the pre's
 * start (block boundary quality) when that doesn't waste too much budget;
 * otherwise let the pre split into two highlighted halves.
 */
const avoidPreInterior = (
    entities: MessageEntity[],
    cut: number,
    hardCut: number
): number => {
    const floor = Math.max(1, Math.floor(hardCut * NEWLINE_FLOOR_RATIO));
    for (const entity of entities) {
        if (
            entity.type === 'pre' &&
            entity.offset < cut &&
            cut < entity.offset + entity.length &&
            entity.offset >= floor
        ) {
            return entity.offset;
        }
    }
    return cut;
};

const canonicalize = (message: RenderedMessage): RenderedMessage => {
    const trimmed = trimMessageEdges(message);
    return { text: trimmed.text, entities: normalizeEntities(trimmed.entities) };
};

export const splitMessage = (
    message: RenderedMessage,
    options?: SplitOptions
): RenderedMessage[] => {
    const maxLength = options?.maxLength ?? DEFAULT_MAX_LENGTH;
    const maxEntities = options?.maxEntities ?? DEFAULT_MAX_ENTITIES;

    const chunks: RenderedMessage[] = [];
    let current = canonicalize(message);

    while (current.text.length > maxLength || current.entities.length > maxEntities) {
        const overflowEntity = current.entities[maxEntities];
        const entityCeil =
            current.entities.length > maxEntities && overflowEntity
                ? overflowEntity.offset
                : Number.POSITIVE_INFINITY;

        // max(1, ...) guards hostile inputs (e.g. 90+ entities at offset 0):
        // progress beats a per-chunk budget violation the server would fix
        const hardCut = Math.max(
            1,
            clampSurrogate(current.text, Math.min(maxLength, entityCeil, current.text.length))
        );

        let cut = findCutPosition(current.text, hardCut);
        cut = avoidPreInterior(current.entities, cut, hardCut);
        if (cut <= 0) cut = hardCut;

        const { head, tail } = clipEntitiesAt(current, cut);
        const cleanHead = canonicalize(head);
        if (cleanHead.text) chunks.push(cleanHead);

        const cleanTail = canonicalize(tail);
        if (cleanTail.text.length >= current.text.length) {
            // No progress (should be unreachable) — emit remainder and stop
            chunks.push(cleanTail);
            return chunks;
        }
        current = cleanTail;
    }

    if (current.text || chunks.length === 0) chunks.push(current);
    return chunks;
};
