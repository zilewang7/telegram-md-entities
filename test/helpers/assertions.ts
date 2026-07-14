import { expect } from 'vitest';
import type { RenderedMessage } from '../../src/types';

/** True when position i falls between the two halves of a surrogate pair */
const splitsSurrogatePair = (text: string, i: number): boolean =>
    i > 0 &&
    i < text.length &&
    (text.charCodeAt(i - 1) & 0xfc00) === 0xd800 &&
    (text.charCodeAt(i) & 0xfc00) === 0xdc00;

export const expectWellFormed = ({ text, entities }: RenderedMessage): void => {
    for (const entity of entities) {
        expect(entity.length).toBeGreaterThan(0);
        expect(entity.offset).toBeGreaterThanOrEqual(0);
        expect(entity.offset + entity.length).toBeLessThanOrEqual(text.length);
        expect(splitsSurrogatePair(text, entity.offset)).toBe(false);
        expect(splitsSurrogatePair(text, entity.offset + entity.length)).toBe(false);
    }
    // Output never carries leading/trailing block gaps
    expect(text).toBe(text.replace(/^\n+/, '').replace(/\n+$/, ''));
};
