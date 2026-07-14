import { describe, expect, it } from 'vitest';
import { normalizeEntities } from '../../src/render/normalize-entities';
import type { MessageEntity } from '../../src/types';

const bold = (offset: number, length: number): MessageEntity => ({
    type: 'bold',
    offset,
    length,
});

describe('normalizeEntities', () => {
    it('merges touching same-type entities', () => {
        expect(normalizeEntities([bold(0, 3), bold(3, 4)])).toEqual([bold(0, 7)]);
    });

    it('does not merge across a gap', () => {
        expect(normalizeEntities([bold(0, 3), bold(4, 2)])).toEqual([
            bold(0, 3),
            bold(4, 2),
        ]);
    });

    it('does not merge different attrs', () => {
        const linkA: MessageEntity = { type: 'text_link', offset: 0, length: 3, url: 'https://a' };
        const linkB: MessageEntity = { type: 'text_link', offset: 3, length: 3, url: 'https://b' };
        expect(normalizeEntities([linkA, linkB])).toEqual([linkA, linkB]);
    });

    it('drops zero-length and contained same-type duplicates', () => {
        expect(normalizeEntities([bold(0, 10), bold(2, 0), bold(3, 4)])).toEqual([
            bold(0, 10),
        ]);
    });

    it('keeps nested different-type entities and sorts stably', () => {
        const italic: MessageEntity = { type: 'italic', offset: 2, length: 3 };
        expect(normalizeEntities([italic, bold(0, 10)])).toEqual([bold(0, 10), italic]);
    });

    it('is idempotent', () => {
        const input = [bold(0, 3), bold(3, 4), { type: 'italic', offset: 1, length: 2 } as const];
        const once = normalizeEntities(input);
        expect(normalizeEntities(once)).toEqual(once);
    });
});
