import { describe, expect, it } from 'vitest';
import { concatMessages } from '../../src/compose/concat-messages';
import { wrapInBlockquote } from '../../src/compose/wrap-in-blockquote';
import { renderMarkdown, validateMessage } from '../../src/index';

describe('wrapInBlockquote', () => {
    it('wraps and strips inner quotes', () => {
        const rendered = renderMarkdown('> 内层引用\n\n**思考**内容');
        const wrapped = wrapInBlockquote(rendered, true);
        expect(wrapped.entities[0]).toEqual({
            type: 'expandable_blockquote',
            offset: 0,
            length: rendered.text.length,
        });
        expect(
            wrapped.entities.filter((entity) => entity.type === 'blockquote')
        ).toEqual([]);
        expect(validateMessage(wrapped)).toEqual([]);
    });

    it('keeps inner formatting', () => {
        const wrapped = wrapInBlockquote(renderMarkdown('思考中 **重点**'));
        expect(wrapped.entities.map((entity) => entity.type)).toEqual([
            'blockquote',
            'bold',
        ]);
    });
});

describe('concatMessages', () => {
    it('re-offsets entities across parts', () => {
        const thinking = wrapInBlockquote(renderMarkdown('思考片段'), true);
        const body = renderMarkdown('回答 **加粗** 结束');
        const combined = concatMessages(thinking, '\n\n', body);

        expect(combined.text).toBe('思考片段\n\n回答 加粗 结束');
        expect(combined.entities).toEqual([
            { type: 'expandable_blockquote', offset: 0, length: 4 },
            { type: 'bold', offset: 9, length: 2 },
        ]);
        expect(validateMessage(combined)).toEqual([]);
    });
});
