import { describe, expect, it } from 'vitest';
import { splitMessage } from '../../src/split/split-message';
import type { MessageEntity, RenderedMessage } from '../../src/types';

const bold = (offset: number, length: number): MessageEntity => ({
    type: 'bold',
    offset,
    length,
});

/** Telegram's ENTITIES_TOO_LONG budget: URLs plus ~20 per link */
const urlBytes = (chunk: RenderedMessage): number =>
    chunk.entities.reduce(
        (total, entity) => total + (entity.url ? entity.url.length + 20 : 0),
        0
    );

/** A source line with a grounding-sized redirect URL */
const sourceLine = (index: number): string => `[${index}] example${index}.com`;

const groundingUrl = (index: number): string =>
    `https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQ${String(index).padStart(4, '0')}${'x'.repeat(200)}`;

describe('splitMessage', () => {
    it('returns a single chunk when everything fits', () => {
        const message: RenderedMessage = { text: 'short 文本', entities: [bold(0, 5)] };
        expect(splitMessage(message)).toEqual([message]);
    });

    it('cuts at a paragraph break, not at a closer weak boundary', () => {
        const para1 = '第一段的内容,有逗号,但是没有换行只有句子。'.repeat(6); // 132 units
        const para2 = '第二段,逗号很多,一直不结束,'.repeat(20);
        const text = `${para1}\n\n${para2}`;
        const [first, second] = splitMessage({ text, entities: [] }, { maxLength: 200 });
        expect(first?.text).toBe(para1);
        expect(second?.text.startsWith('第二段')).toBe(true);
    });

    it('reopens a spanning entity in the next chunk', () => {
        const text = `${'a'.repeat(90)}\n${'b'.repeat(90)}`;
        const spanning = bold(80, 30); // spans the newline cut at 91
        const chunks = splitMessage({ text, entities: [spanning] }, { maxLength: 100 });
        expect(chunks).toHaveLength(2);
        expect(chunks[0]?.entities).toEqual([bold(80, 10)]);
        // 30 = 10 a's + the newline (trimmed at the cut) + 19 b's
        expect(chunks[1]?.entities).toEqual([bold(0, 19)]);
    });

    it('keeps progress when a stack is deeper than the entity budget', () => {
        // 3 entities on the same single character: no chunk containing it can
        // have <= 2 entities — the splitter must still terminate, preserve
        // content, and only exceed the budget on that unsplittable point
        const message: RenderedMessage = {
            text: 'x'.repeat(30),
            entities: [
                { type: 'blockquote', offset: 0, length: 30 },
                bold(10, 5),
                { type: 'italic', offset: 10, length: 5 },
                { type: 'spoiler', offset: 10, length: 5 },
            ],
        };
        const chunks = splitMessage(message, { maxLength: 4096, maxEntities: 2 });
        expect(chunks.map((chunk) => chunk.text).join('')).toBe(message.text);
        for (const chunk of chunks) {
            expect(chunk.entities.length).toBeLessThanOrEqual(4);
        }
    });

    it('keeps pre language on both halves when a code block must split', () => {
        const code = `${'line one\n'.repeat(10)}`.trim();
        const message: RenderedMessage = {
            text: code,
            entities: [{ type: 'pre', offset: 0, length: code.length, language: 'python' }],
        };
        const chunks = splitMessage(message, { maxLength: 40 });
        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(chunk.entities[0]?.type).toBe('pre');
            expect(chunk.entities[0]?.language).toBe('python');
        }
    });

    it('moves a cut out of a pre interior back to the pre start when affordable', () => {
        const prose = `${'文字'.repeat(30)}\n\n`; // 62 units
        const code = 'const x = 1;\nconst y = 2;\nconst z = 3;';
        const text = prose + code;
        const message: RenderedMessage = {
            text,
            entities: [{ type: 'pre', offset: prose.length, length: code.length }],
        };
        const chunks = splitMessage(message, { maxLength: 80 });
        expect(chunks[0]?.text).toBe(prose.trim());
        expect(chunks[1]?.text).toBe(code);
        expect(chunks[1]?.entities).toEqual([{ type: 'pre', offset: 0, length: code.length }]);
    });

    it('honors the entity budget as a cut ceiling', () => {
        // 30 bold words 'wordNN ' — entity every 7 units
        const words = Array.from({ length: 30 }, (_, i) => `word${String(i).padStart(2, '0')}`);
        const text = words.join(' ');
        const entities = words.map((word, i) => bold(i * 7, word.length));
        const chunks = splitMessage({ text, entities }, { maxLength: 4096, maxEntities: 8 });
        expect(chunks.length).toBeGreaterThanOrEqual(4);
        for (const chunk of chunks) {
            expect(chunk.entities.length).toBeLessThanOrEqual(8);
        }
    });

    it('splits when the entity URLs overrun the URL budget', () => {
        // A search-grounding footer: one long redirect URL per source line
        const title = 'GoogleSearch\n';
        const lines = Array.from({ length: 40 }, (_, i) => sourceLine(i + 1));
        const body = lines.join('\n');
        const text = title + body;
        const links: MessageEntity[] = lines.map((line, i) => ({
            type: 'text_link',
            offset: text.indexOf(line),
            length: line.length,
            url: groundingUrl(i + 1),
        }));
        const quote: MessageEntity = {
            type: 'expandable_blockquote',
            offset: title.length,
            length: body.length,
        };
        const chunks = splitMessage({ text, entities: [quote, bold(0, 12), ...links] });

        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(urlBytes(chunk)).toBeLessThanOrEqual(9000);
            // The fold must survive the split, reopened on every chunk
            expect(
                chunk.entities.some(
                    (entity) =>
                        entity.type === 'expandable_blockquote' ||
                        entity.type === 'blockquote'
                )
            ).toBe(true);
        }
        expect(chunks.map((chunk) => chunk.text).join('\n')).toContain(lines[39] ?? '');
    });

    it('keeps a link-laden message whole while it fits the URL budget', () => {
        const lines = Array.from({ length: 5 }, (_, i) => sourceLine(i + 1));
        const text = lines.join('\n');
        const entities: MessageEntity[] = lines.map((line, i) => ({
            type: 'text_link',
            offset: text.indexOf(line),
            length: line.length,
            url: groundingUrl(i + 1),
        }));
        expect(splitMessage({ text, entities })).toHaveLength(1);
    });

    it('terminates when a single entity overruns the whole URL budget', () => {
        const text = `[1] example.com\n${'tail text '.repeat(10)}`;
        const entities: MessageEntity[] = [
            {
                type: 'text_link',
                offset: 0,
                length: 7,
                url: `https://example.com/${'x'.repeat(9500)}`,
            },
        ];
        const chunks = splitMessage({ text, entities });
        expect(chunks.length).toBeGreaterThanOrEqual(1);
        expect(chunks.map((chunk) => chunk.text).join('')).toContain('tail text');
    });
});
