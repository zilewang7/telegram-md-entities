/**
 * A quote renders only inline entities: nesting a block inside one makes
 * clients stop rendering the quote at that point. The walker therefore
 * degrades block content inside a quote instead of emitting `pre` — this is
 * the renderer half of the rule, `wrapInBlockquote` is the compose half.
 */
import { describe, expect, it } from 'vitest';
import { renderMarkdown, validateMessage, wrapInBlockquote, type RenderedMessage } from '../../src/index';

const entityTypes = (message: RenderedMessage): string[] =>
    message.entities.map((entity) => entity.type);

const renderClean = (markdown: string, options?: Parameters<typeof renderMarkdown>[1]): RenderedMessage => {
    const message = renderMarkdown(markdown, options);
    expect(validateMessage(message)).toEqual([]);
    return message;
};

describe('blocks inside a quote', () => {
    it('keeps an indented code block as plain text', () => {
        const message = renderClean('> 引用文本\n>\n>     const x = 1;');
        expect(entityTypes(message)).toEqual(['blockquote']);
        expect(message.text).toBe('引用文本\n\nconst x = 1;');
    });

    it('keeps a fenced code block as plain text, language and all', () => {
        const message = renderClean('> 引用文本\n>\n> ```js\n> const x = 1;\n> ```');
        expect(entityTypes(message)).toEqual(['blockquote']);
        expect(message.text).toBe('引用文本\n\nconst x = 1;');
    });

    it('renders a quoted table as record lines, not a grid', () => {
        const message = renderClean('> | 名称 | 数量 |\n> | --- | --- |\n> | 茶杯 | 2 |');
        expect(entityTypes(message)).toEqual(['blockquote', 'bold']);
        expect(message.text).toBe('• 茶杯\n    • 数量: 2');
    });

    it('renders a table inside <details> as record lines too', () => {
        const message = renderClean(
            '<details>\n<summary>表格</summary>\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n</details>'
        );
        expect(entityTypes(message)).toEqual([
            'expandable_blockquote',
            'bold',
            'bold',
        ]);
        expect(message.text).toContain('• b: 2');
    });

    it('flattens nested quotes instead of nesting a quote entity', () => {
        const message = renderClean('> 外层\n> > 内层');
        expect(entityTypes(message)).toEqual(['blockquote']);
    });

    it('holds the same rule while streaming', () => {
        const message = renderClean('> 引用里\n> ```js\n> const x = 1;', { streaming: true });
        expect(entityTypes(message)).toEqual(['blockquote']);
    });

    it('keeps the pre outside a quote', () => {
        expect(entityTypes(renderClean('文本\n\n    const x = 1;'))).toEqual(['pre']);
        expect(entityTypes(renderClean('文本\n\n```js\nconst x = 1;\n```'))).toEqual(['pre']);
        expect(entityTypes(renderClean('| a | b |\n| --- | --- |\n| 1 | 2 |'))).toEqual(['pre']);
    });

    it('keeps an explicit pre table option flat inside a quote', () => {
        const message = renderClean('> | a | b |\n> | --- | --- |\n> | 1 | 2 |', { table: 'pre' });
        expect(entityTypes(message)).toEqual(['blockquote']);
    });
});

describe('wrapInBlockquote over rendered blocks', () => {
    it('produces a quote Telegram can render for every block shape', () => {
        const shapes = [
            '思考\n\n    const x = 1;',
            '思考\n\n```js\nconst x = 1;\n```',
            '思考\n\n| a | b |\n| --- | --- |\n| 1 | 2 |',
            '> 引用里\n> ```js\n> const x = 1;\n```',
        ];
        for (const markdown of shapes) {
            const wrapped = wrapInBlockquote(renderMarkdown(markdown), true);
            expect(validateMessage(wrapped)).toEqual([]);
            expect(entityTypes(wrapped).filter((type) => type === 'pre')).toEqual([]);
        }
    });
});
