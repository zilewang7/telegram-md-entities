import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, splitMessage, validateMessage } from '../../src/index';
import type { EntityType, RenderedMessage } from '../../src/types';
import { loadCorpus } from '../helpers/corpus';

const stripWs = (value: string): string => value.replace(/\s+/g, '');

/** Non-whitespace text covered by entities of a type, in document order */
const coveredText = (message: RenderedMessage, type: EntityType): string =>
    message.entities
        .filter((entity) => entity.type === type)
        .map((entity) => message.text.slice(entity.offset, entity.offset + entity.length))
        .join('')
        .replace(/\s+/g, '');

const ENTITY_TYPES: EntityType[] = [
    'bold', 'italic', 'strikethrough', 'spoiler', 'code', 'pre',
    'text_link', 'blockquote',
];

const longDocument = (): RenderedMessage => {
    const joined = loadCorpus()
        .map(({ markdown }) => markdown)
        .join('\n\n');
    return renderMarkdown(`${joined}\n\n${joined}`);
};

describe('splitMessage invariants', () => {
    it('all chunks honor both budgets and stay valid', () => {
        const rendered = longDocument();
        fc.assert(
            fc.property(
                fc.integer({ min: 60, max: 500 }),
                // Budget must exceed the deepest entity stack in the corpus
                // (3: quote > bold > link); below that a chunk containing the
                // stacked point cannot mathematically satisfy the budget
                fc.integer({ min: 4, max: 20 }),
                (maxLength, maxEntities) => {
                    const chunks = splitMessage(rendered, { maxLength, maxEntities });
                    for (const chunk of chunks) {
                        expect(chunk.text.length).toBeLessThanOrEqual(maxLength);
                        expect(chunk.entities.length).toBeLessThanOrEqual(maxEntities);
                        expect(chunk.text).toBe(chunk.text.trim());
                        expect(validateMessage(chunk)).toEqual([]);
                    }
                }
            ),
            { numRuns: 60 }
        );
    });

    it('preserves non-whitespace content and per-type entity coverage', () => {
        const rendered = longDocument();
        fc.assert(
            fc.property(
                fc.integer({ min: 80, max: 600 }),
                fc.integer({ min: 3, max: 30 }),
                (maxLength, maxEntities) => {
                    const chunks = splitMessage(rendered, { maxLength, maxEntities });

                    const joinedText = chunks.map((chunk) => chunk.text).join('');
                    expect(stripWs(joinedText)).toBe(stripWs(rendered.text));

                    for (const type of ENTITY_TYPES) {
                        const original = coveredText(rendered, type);
                        const rejoined = chunks.map((chunk) => coveredText(chunk, type)).join('');
                        expect(rejoined).toBe(original);
                    }
                }
            ),
            { numRuns: 40 }
        );
    });
});
