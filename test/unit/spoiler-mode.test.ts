import { describe, expect, it } from 'vitest';
import { renderMarkdown, validateMessage } from '../../src/index';

const spoilerEntities = (markdown: string, mode?: 'loose' | 'strict') => {
    const rendered = renderMarkdown(
        markdown,
        mode ? { spoilerMode: mode } : undefined
    );
    expect(validateMessage(rendered)).toEqual([]);
    return {
        text: rendered.text,
        spoilers: rendered.entities.filter((entity) => entity.type === 'spoiler'),
    };
};

describe('spoilerMode loose (default)', () => {
    it('flanking-tight spoiler still works', () => {
        const { text, spoilers } = spoilerEntities('||剧透||');
        expect(text).toBe('剧透');
        expect(spoilers).toHaveLength(1);
    });

    it('whitespace-padded content matches (Telegram-style)', () => {
        // Line-edge whitespace is trimmed by the parser; inner padding kept
        const { text, spoilers } = spoilerEntities('|| 谢谢惠顾 🍂 ||');
        expect(text).toBe('谢谢惠顾 🍂');
        expect(spoilers).toHaveLength(1);
        expect(spoilers[0]).toEqual({
            type: 'spoiler',
            offset: 0,
            length: text.length,
        });
    });

    it('multiple padded spoilers on one line pair sequentially', () => {
        const { text, spoilers } = spoilerEntities(
            '|| 🎸 吉他 ||  || 🥁 架子鼓 ||'
        );
        expect(text).not.toContain('||');
        expect(spoilers).toHaveLength(2);
    });

    it('spoiler inside fullwidth brackets', () => {
        const { text, spoilers } = spoilerEntities('【 || 谢谢惠顾！ || 】');
        expect(text).toBe('【  谢谢惠顾！  】');
        expect(spoilers).toHaveLength(1);
    });

    it('unpaired || stays literal', () => {
        const { text, spoilers } = spoilerEntities('a || b');
        expect(text).toBe('a || b');
        expect(spoilers).toHaveLength(0);
    });

    it('streaming render converges with strict-mode final render', () => {
        const source = '刮开：|| 谢谢惠顾 🍂 || 和 **加粗**';
        const streamed = renderMarkdown(source, { streaming: true });
        const final = renderMarkdown(source);
        expect(streamed).toEqual(final);
    });

    it('streaming half-open padded spoiler renders as spoiler', () => {
        const streamed = renderMarkdown('刮开：|| 谢谢惠', { streaming: true });
        expect(streamed.text).toBe('刮开： 谢谢惠');
        expect(
            streamed.entities.filter((entity) => entity.type === 'spoiler')
        ).toHaveLength(1);
    });
});

describe('spoilerMode strict', () => {
    it('whitespace-padded content stays literal', () => {
        const { text, spoilers } = spoilerEntities('|| 谢谢惠顾 ||', 'strict');
        expect(text).toBe('|| 谢谢惠顾 ||');
        expect(spoilers).toHaveLength(0);
    });

    it('flanking-tight spoiler still works', () => {
        const { text, spoilers } = spoilerEntities('||剧透||', 'strict');
        expect(text).toBe('剧透');
        expect(spoilers).toHaveLength(1);
    });
});
