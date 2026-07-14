import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/index';

const REAL_WORLD_EXAMPLE = [
    '<details>',
    '<summary>👉 点击展开隐藏的秘密 🤫</summary>',
    '<br>',
    '',
    '其实我们今天又没有练习!',
    '',
    '</details>',
].join('\n');

describe('<details>/<summary> → expandable blockquote', () => {
    it('renders the real-world LLM pattern: quote + bold summary, no tags visible', () => {
        const { text, entities } = renderMarkdown(REAL_WORLD_EXAMPLE);
        expect(text).toBe('👉 点击展开隐藏的秘密 🤫\n\n\n其实我们今天又没有练习!');
        expect(entities).toEqual([
            { type: 'expandable_blockquote', offset: 0, length: text.length },
            { type: 'bold', offset: 0, length: 15 },
        ]);
    });

    it('works without a summary tag', () => {
        const { text, entities } = renderMarkdown('<details>\n只有内容,没有标题。\n</details>');
        expect(text).toBe('只有内容,没有标题。');
        expect(entities).toEqual([
            { type: 'expandable_blockquote', offset: 0, length: text.length },
        ]);
    });

    it('handles the single-line form and keeps trailing text outside the quote', () => {
        const { text, entities } = renderMarkdown(
            '<details><summary>标题</summary>内容。</details>\n后续段落。'
        );
        expect(text).toBe('标题\n\n\n内容。\n\n后续段落。');
        expect(entities).toEqual([
            { type: 'expandable_blockquote', offset: 0, length: 8 },
            { type: 'bold', offset: 0, length: 2 },
        ]);
    });

    it('renders markdown inside the element content', () => {
        const { text, entities } = renderMarkdown(
            '<details>\n<summary>S</summary>\n\n有 **加粗** 和 `代码`。\n\n- 列表项\n</details>'
        );
        expect(text).toBe('S\n\n\n有 加粗 和 代码。\n\n• 列表项');
        const types = entities.map((entity) => entity.type);
        expect(types).toContain('expandable_blockquote');
        expect(types).toContain('bold');
        expect(types).toContain('code');
    });

    it('tolerates a blank line between <details> and <summary>', () => {
        const { text, entities } = renderMarkdown(
            '<details>\n\n<summary>迟到的标题</summary>\n\n正文。\n\n</details>'
        );
        expect(text).toBe('迟到的标题\n\n\n正文。');
        expect(entities.map((entity) => entity.type)).toEqual([
            'expandable_blockquote',
            'bold',
        ]);
    });

    it('flattens when already inside a blockquote (Telegram quotes cannot nest)', () => {
        const { text, entities } = renderMarkdown(
            '> 引用开头\n> <details>\n> <summary>标题</summary>\n> 正文\n> </details>'
        );
        expect(text).not.toContain('<');
        expect(text).toContain('标题');
        expect(text).toContain('正文');
        const quotes = entities.filter(
            (entity) =>
                entity.type === 'blockquote' || entity.type === 'expandable_blockquote'
        );
        expect(quotes).toHaveLength(1);
    });

    it('flattens nested details into a single expandable quote', () => {
        const { text, entities } = renderMarkdown(
            '<details><summary>外层</summary>\n\n<details><summary>内层</summary>\n内层内容\n</details>\n\n外层内容\n</details>'
        );
        expect(text).not.toContain('<');
        expect(text).toContain('内层内容');
        expect(text).toContain('外层内容');
        expect(
            entities.filter((entity) => entity.type === 'expandable_blockquote')
        ).toHaveLength(1);
    });

    it('leaves no dangling padding when the element has only a summary', () => {
        const { text, entities } = renderMarkdown(
            '<details><summary>只有标题</summary></details>'
        );
        expect(text).toBe('只有标题');
        expect(entities.map((entity) => entity.type)).toEqual([
            'expandable_blockquote',
            'bold',
        ]);
    });

    it('renders an unclosed element leniently as a quote to the end', () => {
        const { text, entities } = renderMarkdown('<details>\n<summary>标题</summary>\n正文继续');
        expect(text).toBe('标题\n\n\n正文继续');
        expect(entities.map((entity) => entity.type)).toEqual([
            'expandable_blockquote',
            'bold',
        ]);
    });

    describe('streaming frames', () => {
        it('hides a freshly opened element and half-typed tags', () => {
            for (const buffer of ['前文\n\n<details>', '前文\n\n<details>\n<summ']) {
                const { text } = renderMarkdown(buffer, { streaming: true });
                expect(text).toBe('前文');
            }
        });

        it('shows an in-progress summary as bold inside the quote', () => {
            const { text, entities } = renderMarkdown('<details>\n<summary>点击展开', {
                streaming: true,
            });
            expect(text).toBe('点击展开');
            expect(entities.map((entity) => entity.type).sort()).toEqual([
                'bold',
                'expandable_blockquote',
            ]);
        });

        it('converges with the strict render on the complete document', () => {
            const strict = renderMarkdown(REAL_WORLD_EXAMPLE);
            const streaming = renderMarkdown(REAL_WORLD_EXAMPLE, { streaming: true });
            expect(streaming).toEqual(strict);
        });
    });
});
