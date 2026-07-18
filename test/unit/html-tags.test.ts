import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/index';
import type { MessageEntity } from '../../src/index';

const entitiesOf = (markdown: string): { text: string; entities: MessageEntity[] } =>
    renderMarkdown(markdown);

describe('HTML formatting tags', () => {
    it('renders a simple pair as a bold entity, tags never leak into text', () => {
        const { text, entities } = entitiesOf('粗体 <b>加粗</b> 结束');
        expect(text).toBe('粗体 加粗 结束');
        expect(entities).toEqual([{ type: 'bold', offset: 3, length: 2 }]);
    });

    it('renders multiple sibling pairs independently', () => {
        const { text, entities } = entitiesOf('<b>多个</b> 和 <i>标签</i> 与 <u>下划线</u>');
        expect(text).toBe('多个 和 标签 与 下划线');
        expect(entities).toContainEqual({ type: 'bold', offset: 0, length: 2 });
        expect(entities).toContainEqual({ type: 'italic', offset: 5, length: 2 });
        expect(entities).toContainEqual({ type: 'underline', offset: 10, length: 3 });
    });

    it('renders nested tags as nested entities', () => {
        const { text, entities } = entitiesOf('<b><i>嵌套</i></b>');
        expect(text).toBe('嵌套');
        expect(entities).toContainEqual({ type: 'bold', offset: 0, length: 2 });
        expect(entities).toContainEqual({ type: 'italic', offset: 0, length: 2 });
    });

    it('recovers from mismatched nesting with properly nested entities', () => {
        const { text, entities } = entitiesOf('a <b>b <i>c</b> d</i>');
        expect(text).toBe('a b c d');
        expect(entities).toContainEqual({ type: 'bold', offset: 2, length: 3 });
        // italic split into the part inside bold and the part after it
        expect(entities).toContainEqual({ type: 'italic', offset: 4, length: 1 });
        expect(entities).toContainEqual({ type: 'italic', offset: 5, length: 2 });
    });

    it('spans soft line breaks inside a paragraph', () => {
        const { text, entities } = entitiesOf('<b>跨行\n第二行</b>');
        expect(text).toBe('跨行\n第二行');
        expect(entities).toEqual([{ type: 'bold', offset: 0, length: 6 }]);
    });

    it('closes at block end when the pair spans a blank line, losing no text', () => {
        const { text, entities } = entitiesOf('<b>跨空行\n\n第二段</b>');
        expect(text).toBe('跨空行\n\n第二段');
        expect(entities).toEqual([{ type: 'bold', offset: 0, length: 3 }]);
    });

    it('mixes with markdown formatting in both directions', () => {
        const outer = entitiesOf('**markdown <i>混排</i> 加粗**');
        expect(outer.text).toBe('markdown 混排 加粗');
        expect(outer.entities).toContainEqual({ type: 'bold', offset: 0, length: 14 });
        expect(outer.entities).toContainEqual({ type: 'italic', offset: 9, length: 2 });

        const inner = entitiesOf('<b>混 **markdown** 排</b>');
        expect(inner.text).toBe('混 markdown 排');
        expect(inner.entities).toContainEqual({ type: 'bold', offset: 0, length: 12 });
    });

    it('leniently styles the rest of the block for an unclosed tag', () => {
        const { text, entities } = entitiesOf('未闭合 <b>后面全部');
        expect(text).toBe('未闭合 后面全部');
        expect(entities).toEqual([{ type: 'bold', offset: 4, length: 4 }]);
    });

    it('drops a stray close of a known tag, keeps surrounding text', () => {
        const { text, entities } = entitiesOf('孤立关闭 </b> 标签');
        expect(text).toBe('孤立关闭  标签');
        expect(entities).toEqual([]);
    });

    it('keeps backslash-escaped and entity-encoded tags literal', () => {
        expect(entitiesOf('转义 \\<b\\>不是标签\\</b\\>').text).toBe('转义 <b>不是标签</b>');
        expect(entitiesOf('实体 &lt;b&gt;也不是').text).toBe('实体 <b>也不是');
        expect(entitiesOf('转义 \\<b\\>不是标签\\</b\\>').entities).toEqual([]);
    });

    it('keeps unknown tags literal (inline and block)', () => {
        expect(entitiesOf('<notreal>未知行内</notreal>').text).toBe('<notreal>未知行内</notreal>');
        expect(entitiesOf('<div>未知块级</div>').text).toBe('<div>未知块级</div>');
    });

    it('supports every alias of the Telegram HTML tag set', () => {
        const { text, entities } = entitiesOf(
            '<strong>a</strong> <em>b</em> <ins>c</ins> <s>d</s> <strike>e</strike> <del>f</del>'
        );
        expect(text).toBe('a b c d e f');
        expect(entities).toContainEqual({ type: 'bold', offset: 0, length: 1 });
        expect(entities).toContainEqual({ type: 'italic', offset: 2, length: 1 });
        expect(entities).toContainEqual({ type: 'underline', offset: 4, length: 1 });
        expect(entities).toContainEqual({ type: 'strikethrough', offset: 6, length: 1 });
        expect(entities).toContainEqual({ type: 'strikethrough', offset: 8, length: 1 });
        expect(entities).toContainEqual({ type: 'strikethrough', offset: 10, length: 1 });
    });

    it('is case-insensitive and tolerates whitespace before >', () => {
        const { text, entities } = entitiesOf('<B>大写</B> <b >空格</b >');
        expect(text).toBe('大写 空格');
        expect(entities).toContainEqual({ type: 'bold', offset: 0, length: 2 });
        expect(entities).toContainEqual({ type: 'bold', offset: 3, length: 2 });
    });

    it('renders <code> as a code entity', () => {
        const { text, entities } = entitiesOf('<code>x < y</code>');
        expect(text).toBe('x < y');
        expect(entities).toEqual([{ type: 'code', offset: 0, length: 5 }]);
    });

    it('renders a <pre> block without artificial edge newlines', () => {
        const { text, entities } = entitiesOf('<pre>\nline1\nline2\n</pre>');
        expect(text).toBe('line1\nline2');
        expect(entities).toEqual([{ type: 'pre', offset: 0, length: 11 }]);
    });

    it('collapses <pre><code class="language-x"> into a pre entity with language', () => {
        const { text, entities } = entitiesOf(
            '<pre><code class="language-js">console.log(1)</code></pre>'
        );
        expect(text).toBe('console.log(1)');
        expect(entities).toEqual([{ type: 'pre', offset: 0, length: 14, language: 'js' }]);
    });

    it('renders <a href> as text_link with the shared url policy', () => {
        const linked = entitiesOf('<a href="https://example.com">链接</a>');
        expect(linked.text).toBe('链接');
        expect(linked.entities).toEqual([
            { type: 'text_link', offset: 0, length: 2, url: 'https://example.com' },
        ]);
        // Unsupported scheme: label survives, entity is dropped
        const rejected = entitiesOf('<a href="mailto:x@y.z">坏链接</a>');
        expect(rejected.text).toBe('坏链接');
        expect(rejected.entities).toEqual([]);
    });

    it('renders spoiler tags and keeps a plain <span> literal', () => {
        const { text, entities } = entitiesOf(
            '<tg-spoiler>剧透</tg-spoiler> <span class="tg-spoiler">剧透2</span> <span>普通span</span>'
        );
        expect(text).toBe('剧透 剧透2 <span>普通span</span>');
        expect(entities).toContainEqual({ type: 'spoiler', offset: 0, length: 2 });
        expect(entities).toContainEqual({ type: 'spoiler', offset: 3, length: 3 });
    });

    it('turns <br> into a newline and ignores a self-closing formatting tag', () => {
        expect(entitiesOf('含 <br/> 换行').text).toBe('含 \n 换行');
        expect(entitiesOf('<b/>自闭合').text).toBe('自闭合');
        expect(entitiesOf('<b/>自闭合').entities).toEqual([]);
    });

    it('renders adjacent pairs without bleeding into each other', () => {
        const { text, entities } = entitiesOf('<b>贴着</b><i>连续</i>');
        expect(text).toBe('贴着连续');
        expect(entities).toContainEqual({ type: 'bold', offset: 0, length: 2 });
        expect(entities).toContainEqual({ type: 'italic', offset: 2, length: 2 });
    });

    it('renders tags inside a <summary> of a details element', () => {
        const { entities } = entitiesOf(
            '<details><summary>标题 <b>加粗</b></summary>正文</details>'
        );
        expect(entities.some((e) => e.type === 'expandable_blockquote')).toBe(true);
        expect(entities.some((e) => e.type === 'bold')).toBe(true);
    });

    it('renders <ul>/<li> as bullet lines, markup whitespace dropped', () => {
        const { text, entities } = entitiesOf(
            '<ul>\n  <li><b>加粗项</b>：说明文字</li>\n  <li>第二项</li>\n</ul>'
        );
        expect(text).toBe('• 加粗项：说明文字\n• 第二项');
        expect(entities).toEqual([{ type: 'bold', offset: 2, length: 3 }]);
    });

    it('renders <ol>/<li> as numbered lines', () => {
        expect(entitiesOf('<ol>\n<li>一</li>\n<li>二</li>\n</ol>').text).toBe('1. 一\n2. 二');
    });

    it('indents nested HTML lists', () => {
        expect(entitiesOf('<ul><li>甲<ul><li>嵌套子项</li></ul></li><li>乙</li></ul>').text).toBe(
            '• 甲\n    • 嵌套子项\n• 乙'
        );
    });

    it('keeps content for a bare <li> and an unclosed <ul>', () => {
        expect(entitiesOf('裸 <li>项目</li> 标签').text).toBe('裸 \n• 项目 标签');
        expect(entitiesOf('前文\n\n<ul>\n<li>未闭合列表').text).toBe('前文\n\n• 未闭合列表');
    });

    it('renders lists inside a <details> element', () => {
        const { text, entities } = entitiesOf(
            '<details>\n<summary>汇总</summary>\n说明。\n<ul>\n  <li><b>品牌</b>：八喜。</li>\n</ul>\n</details>'
        );
        expect(text).toContain('• 品牌：八喜。');
        expect(entities.some((e) => e.type === 'expandable_blockquote')).toBe(true);
    });

    it('strips tags in table cells: <br> becomes a space, formatting drops', () => {
        // CJK content forces record mode
        const records = entitiesOf('| A<br>B | C |\n| --- | --- |\n| <b>粗</b>1<br>2 | 中文内容 |');
        expect(records.text).not.toContain('<br>');
        expect(records.text).not.toContain('<b>');
        expect(records.text).toContain('粗1 2');
        // ASCII-only content renders as an aligned pre grid
        const grid = entitiesOf('| A | B |\n| --- | --- |\n| a1<br>a2 | b |');
        expect(grid.text).toContain('a1 a2');
        expect(grid.text).not.toContain('<br>');
    });

    it('never throws and never loses body text on malformed soup', () => {
        const soups = [
            '<b><i><u>三层未闭合',
            '</i></b></u> 全是孤立关闭',
            '<b>a<i>b<u>c</b>d</i>e</u>f',
            '<a href=>空 href</a>',
            '<a>无 href</a>',
            '<code><b>标签在 code 内</b></code>',
            '<pre>未闭合 pre',
            '文本 < 不是标签 > 文本',
            '<b',
        ];
        for (const soup of soups) {
            const { text } = renderMarkdown(soup);
            // Every CJK content char must survive rendering
            for (const chunk of soup.match(/[一-鿿]+/g) ?? []) {
                expect(text).toContain(chunk);
            }
        }
    });
});
