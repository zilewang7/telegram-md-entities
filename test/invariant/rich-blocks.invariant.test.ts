import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
    renderMarkdown,
    richBlocksToMarkdown,
    richTextToMarkdown,
    richTextToPlain,
    validateMessage,
} from '../../src/index';
import type { RichBlockNode, RichTextNode } from '../../src/index';

/** What the bot actually receives: parsed JSON, typed `any` by JSON.parse */
const asReceived = (value: unknown) => JSON.parse(JSON.stringify(value ?? null));

const KNOWN_BLOCK_TYPES = [
    'paragraph', 'heading', 'pre', 'footer', 'divider', 'mathematical_expression', 'anchor',
    'list', 'blockquote', 'pullquote', 'table', 'details', 'collage', 'slideshow', 'map',
    'photo', 'video', 'animation', 'audio', 'voice_note', 'thinking',
    'expandable_blockquote', 'document', 'buttons', 'future_block',
];
const KNOWN_INLINE_TYPES = [
    'bold', 'italic', 'code', 'url', 'text_mention', 'custom_emoji', 'mathematical_expression',
    'anchor', 'button', 'ton_address', 'future_inline',
];

/** Known type names with arbitrary (usually wrong) fields: malformed known blocks */
const malformedBlock = fc.record(
    {
        type: fc.constantFrom(...KNOWN_BLOCK_TYPES),
        text: fc.jsonValue({ maxDepth: 2 }),
        blocks: fc.jsonValue({ maxDepth: 2 }),
        items: fc.jsonValue({ maxDepth: 2 }),
        cells: fc.jsonValue({ maxDepth: 2 }),
        buttons: fc.jsonValue({ maxDepth: 2 }),
        document: fc.jsonValue({ maxDepth: 1 }),
        size: fc.jsonValue({ maxDepth: 0 }),
        caption: fc.jsonValue({ maxDepth: 2 }),
        location: fc.jsonValue({ maxDepth: 1 }),
    },
    { requiredKeys: ['type'] }
);
const malformedInline = fc.record(
    {
        type: fc.constantFrom(...KNOWN_INLINE_TYPES),
        text: fc.jsonValue({ maxDepth: 2 }),
        url: fc.jsonValue({ maxDepth: 0 }),
        user: fc.jsonValue({ maxDepth: 1 }),
        button: fc.jsonValue({ maxDepth: 2 }),
        alternative_text: fc.jsonValue({ maxDepth: 0 }),
        expression: fc.jsonValue({ maxDepth: 0 }),
    },
    { requiredKeys: ['type'] }
);

/** Well-typed trees, for the round-trip property */
const plainText = fc
    .array(fc.constantFrom('文字', 'text', ' ', '*', '_', '|', '`', '<b>', '\n', '# ', '1. ', '[x](y)', '😂'), {
        minLength: 1,
        maxLength: 6,
    })
    .map((parts) => parts.join(''));
const richText: fc.Arbitrary<RichTextNode> = fc.letrec<{ text: RichTextNode }>((tie) => ({
    text: fc.oneof(
        { depthSize: 'small', withCrossShrink: true },
        plainText,
        fc.array(tie('text'), { maxLength: 3 }),
        fc.record({ type: fc.constantFrom('bold' as const, 'italic' as const, 'underline' as const, 'spoiler' as const), text: tie('text') }),
        fc.record({ type: fc.constant('url' as const), text: plainText, url: fc.constant('https://example.com/a') }),
        fc.record({ type: fc.constant('button' as const), button: fc.record({ text: plainText }, { requiredKeys: ['text'] }) })
    ),
})).text;
const block: fc.Arbitrary<RichBlockNode> = fc.letrec<{ block: RichBlockNode }>((tie) => ({
    block: fc.oneof(
        { depthSize: 'small', withCrossShrink: true },
        fc.record({ type: fc.constant('paragraph' as const), text: richText }),
        fc.record({ type: fc.constant('expandable_blockquote' as const), text: richText }),
        fc.record({ type: fc.constant('document' as const), document: fc.record({ file_name: plainText }) }),
        fc.record({
            type: fc.constant('buttons' as const),
            buttons: fc.array(fc.record({ text: richText, url: fc.constant('https://t.me') }, { requiredKeys: ['text'] }), { maxLength: 3 }),
        }),
        fc.record({ type: fc.constant('blockquote' as const), blocks: fc.array(tie('block'), { maxLength: 2 }) }),
        fc.record({
            type: fc.constant('list' as const),
            items: fc.array(fc.record({ label: fc.constant('•'), blocks: fc.array(tie('block'), { maxLength: 2 }) }), { maxLength: 2 }),
        })
    ),
})).block;

describe('rich block invariants', () => {
    it('arbitrary JSON as blocks or rich text never throws', () => {
        fc.assert(
            fc.property(fc.jsonValue(), (value) => {
                const received = asReceived(value);
                expect(typeof richBlocksToMarkdown(received)).toBe('string');
                expect(typeof richBlocksToMarkdown([received])).toBe('string');
                expect(typeof richTextToMarkdown(received)).toBe('string');
                expect(typeof richTextToPlain(received)).toBe('string');
            }),
            { numRuns: 500 }
        );
    });

    it('malformed blocks and inline nodes of known types never throw', () => {
        fc.assert(
            fc.property(fc.array(malformedBlock, { maxLength: 4 }), fc.array(malformedInline, { maxLength: 4 }), (blocks, inline) => {
                expect(typeof richBlocksToMarkdown(asReceived(blocks))).toBe('string');
                const paragraph = asReceived([{ type: 'paragraph', text: inline }]);
                expect(typeof richBlocksToMarkdown(paragraph)).toBe('string');
                expect(typeof richTextToPlain(asReceived(inline))).toBe('string');
            }),
            { numRuns: 500 }
        );
    });

    it('well-typed block trees re-render into a valid message', () => {
        fc.assert(
            fc.property(fc.array(block, { maxLength: 4 }), (blocks) => {
                const rendered = renderMarkdown(richBlocksToMarkdown(blocks));
                const issues = validateMessage(rendered).filter((issue) => issue.code !== 'text-too-long');
                expect(issues).toEqual([]);
            }),
            { numRuns: 300 }
        );
    });
});
