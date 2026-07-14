/**
 * Canonicalize an entity list: stable sort, drop zero-length and redundant
 * duplicates, merge touching same-type runs. The server merges adjacent
 * same-type entities anyway (display cannot differ), so merging up front
 * buys headroom against the ~100-entities-per-message cap and makes e2e
 * round-trip comparison converge.
 */
import type { EntityType, MessageEntity } from '../types';

/**
 * Tie-break for entities sharing the exact same span: containment order is
 * ambiguous, so impose the only nesting-legal one — quotes outermost,
 * pre/code innermost, formatting in between.
 */
const nestingPriority = (type: EntityType): number => {
    if (type === 'blockquote' || type === 'expandable_blockquote') return 0;
    if (type === 'pre' || type === 'code') return 2;
    return 1;
};

/** Canonical entity order: offset asc, outer (longer) first, quotes outermost */
export const compareEntities = (a: MessageEntity, b: MessageEntity): number =>
    a.offset - b.offset ||
    b.length - a.length ||
    nestingPriority(a.type) - nestingPriority(b.type);

const sameAttrs = (a: MessageEntity, b: MessageEntity): boolean =>
    a.type === b.type && a.url === b.url && a.language === b.language;

const contains = (outer: MessageEntity, inner: MessageEntity): boolean =>
    outer.offset <= inner.offset &&
    outer.offset + outer.length >= inner.offset + inner.length;

export const normalizeEntities = (entities: MessageEntity[]): MessageEntity[] => {
    const sorted = entities
        .filter((entity) => entity.length > 0)
        .sort(compareEntities);

    const result: MessageEntity[] = [];
    for (const entity of sorted) {
        // Same-type entity fully inside an already-kept one adds nothing
        const redundant = result.some(
            (kept) => sameAttrs(kept, entity) && contains(kept, entity)
        );
        if (redundant) continue;

        const previous = result[result.length - 1];
        if (
            previous &&
            sameAttrs(previous, entity) &&
            previous.offset + previous.length === entity.offset
        ) {
            previous.length = entity.offset + entity.length - previous.offset;
            continue;
        }

        result.push({ ...entity });
    }

    return result;
};
