import { describe, expect, it } from 'vitest';
import { concatMessages, renderMarkdown, toRichHtml, wrapInBlockquote } from '../../src/index';
import type { EntityType, MessageEntity, RenderedMessage } from '../../src/index';

const entity = (type: EntityType, offset: number, length: number, extra: Partial<MessageEntity> = {}): MessageEntity => ({
    type,
    offset,
    length,
    ...extra,
});

describe('toRichHtml', () => {
    it('an empty message gives an empty string', () => {
        expect(toRichHtml({ text: '', entities: [] })).toBe('');
        expect(toRichHtml({ text: '\n\n', entities: [] })).toBe('');
    });

    it('every inline entity type maps to its tag', () => {
        const message: RenderedMessage = {
            text: 'b i u s p c l',
            entities: [
                entity('bold', 0, 1),
                entity('italic', 2, 1),
                entity('underline', 4, 1),
                entity('strikethrough', 6, 1),
                entity('spoiler', 8, 1),
                entity('code', 10, 1),
                entity('text_link', 12, 1, { url: 'https://example.com/a?b=1&c="d"' }),
            ],
        };
        expect(toRichHtml(message)).toBe(
            '<p><b>b</b> <i>i</i> <u>u</u> <s>s</s> <tg-spoiler>p</tg-spoiler> <code>c</code> ' +
                '<a href="https://example.com/a?b=1&amp;c=&quot;d&quot;">l</a></p>'
        );
    });

    it('overlapping entities close and reopen into proper nesting', () => {
        const message: RenderedMessage = {
            text: 'abcdef',
            entities: [entity('bold', 0, 4), entity('italic', 2, 4)],
        };
        expect(toRichHtml(message)).toBe('<p><b>ab<i>cd</i></b><i>ef</i></p>');
    });

    it('text is escaped; newlines become <br>; blank lines split paragraphs', () => {
        const message = renderMarkdown('a < b && c > d\nsecond **line**\n\nnext <tag>');
        expect(toRichHtml(message)).toBe(
            '<p>a &lt; b &amp;&amp; c &gt; d<br>second <b>line</b></p>\n\n<p>next &lt;tag&gt;</p>'
        );
    });

    it('quotes become blockquotes with <br> for every newline, never a blank line', () => {
        const thinking = wrapInBlockquote(renderMarkdown('想法 **重点**\n\n第二段\n第三行'), true);
        expect(toRichHtml(thinking)).toBe(
            '<blockquote expandable>想法 <b>重点</b><br><br>第二段<br>第三行</blockquote>'
        );
        const quote = renderMarkdown('> 引用 _斜_\n\n正文');
        expect(toRichHtml(quote)).toBe('<blockquote>引用 <i>斜</i></blockquote>\n\n<p>正文</p>');
    });

    it('pre keeps its text and carries the language; an empty line ends in &#10;', () => {
        const message = renderMarkdown(
            '前\n\n```ts\nconst a = 1 < 2;\n\nlet b = "x";\n    indented\n```\n\n```\nplain\n```'
        );
        expect(toRichHtml(message)).toBe(
            '<p>前</p>\n\n' +
                '<pre><code class="language-ts">const a = 1 &lt; 2;\n&#10;let b = "x";\n    indented</code></pre>\n\n' +
                '<pre>plain</pre>'
        );
    });

    it('no line inside pre is empty or blank, whatever the run of empty lines', () => {
        const message: RenderedMessage = { text: 'x\n\n\ny\n  \nz\n', entities: [entity('pre', 0, 12)] };
        const html = toRichHtml(message);
        expect(html).toBe('<pre>x\n&#10;\ny\n  &#10;z\n</pre>');
        for (const line of html.split('\n')) expect(line.trim()).not.toBe('');
        // Decoding the references gives the text back
        expect(html.replace(/&#10;/g, '\n').replace(/^<pre>|<\/pre>$/g, '')).toBe(message.text);
    });

    it('spaces that would collapse become &nbsp; outside pre', () => {
        const message: RenderedMessage = {
            text: 'a  b   c\n  lead\n single',
            entities: [entity('bold', 1, 3)],
        };
        expect(toRichHtml(message)).toBe('<p>a<b> &nbsp;b</b> &nbsp;&nbsp;c<br>&nbsp;&nbsp;lead<br>&nbsp;single</p>');
        const quote = wrapInBlockquote({ text: 'x  y', entities: [] });
        expect(toRichHtml(quote)).toBe('<blockquote>x &nbsp;y</blockquote>');
    });

    it('a pre nested in a quote renders as inline code, split at line breaks', () => {
        const message: RenderedMessage = {
            text: 'quote\nline one\n\nline two',
            entities: [entity('blockquote', 0, 24), entity('pre', 6, 18)],
        };
        expect(toRichHtml(message)).toBe(
            '<blockquote>quote<br><code>line one</code><br><br><code>line two</code></blockquote>'
        );
    });

    it('composed sections: quote, text and footer each become one block', () => {
        const gap: RenderedMessage = { text: '\n\n', entities: [] };
        const message = concatMessages(
            wrapInBlockquote(renderMarkdown('思考'), true),
            gap,
            renderMarkdown('回答 [链接](https://a.com)'),
            gap,
            renderMarkdown('_— 页脚_')
        );
        const html = toRichHtml(message);
        expect(html).toBe(
            '<blockquote expandable>思考</blockquote>\n\n<p>回答 <a href="https://a.com">链接</a></p>\n\n<p><i>— 页脚</i></p>'
        );
    });

    it('no block contains a blank line, only pre a newline, and every block starts with a tag', () => {
        const message = renderMarkdown(
            '> q1\n>\n> q2\n\n<details>\n<summary>S</summary>\n\nA\n\nB\n</details>\n\n```\nx\n\ny\n```\n\n**p1**\n\np2'
        );
        const blocks = toRichHtml(message).split('\n\n<');
        for (const [index, block] of blocks.entries()) {
            const html = index === 0 ? block : `<${block}`;
            expect(html.startsWith('<')).toBe(true);
            if (!html.startsWith('<pre')) expect(html).not.toContain('\n');
            for (const line of html.split('\n')) expect(line.trim()).not.toBe('');
        }
    });

    it('entities out of range are clamped, empty ones ignored', () => {
        const message: RenderedMessage = {
            text: 'abc',
            entities: [entity('bold', 1, 10), entity('italic', 0, 0)],
        };
        expect(toRichHtml(message)).toBe('<p>a<b>bc</b></p>');
    });
});
