import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, styleSegments, toRichMarkdown } from '../../src/index';
import type { RichMarkdownOptions } from '../../src/index';

/** The rewrite must not change what the package itself shows */
const expectSameDisplay = (markdown: string, options: RichMarkdownOptions = {}): string => {
    const rich = toRichMarkdown(markdown, options);
    const renderOptions = {
        ...(options.underline !== undefined ? { underline: options.underline } : {}),
        ...(options.spoilerMode !== undefined ? { spoilerMode: options.spoilerMode } : {}),
    };
    expect(styleSegments(renderMarkdown(rich, renderOptions))).toEqual(
        styleSegments(renderMarkdown(markdown, renderOptions))
    );
    return rich;
};

describe('toRichMarkdown: delimiters become tags', () => {
    it.each([
        ['__u__ and **b**', '<u>u</u> and <b>b</b>'],
        ['*i* and _i_', '<i>i</i> and <i>i</i>'],
        ['~~s~~ and ~s~', '<s>s</s> and <s>s</s>'],
        ['***both***', '<i><b>both</b></i>'],
        ['___both___', '<i><u>both</u></i>'],
        ['**a __b__ c**', '<b>a <u>b</u> c</b>'],
        ['__**nested** ||s||__', '<u><b>nested</b> <tg-spoiler>s</tg-spoiler></u>'],
        ['的**"重点"**后', '的<b>"重点"</b>后'],
        ['||tight|| and || loose ||', '<tg-spoiler>tight</tg-spoiler> and <tg-spoiler> loose </tg-spoiler>'],
        ['[__label__](https://a.com)', '[<u>label</u>](https://a.com)'],
        ['# 标题 **粗**', '# 标题 <b>粗</b>'],
        ['> 引用 **粗**\n>\n> - 列表 _斜_', '> 引用 <b>粗</b>\n>\n> - 列表 <i>斜</i>'],
    ])('%j', (input, expected) => {
        expect(expectSameDisplay(input)).toBe(expected);
    });

    it('underline: false writes __x__ as bold, like the renderer reads it', () => {
        expect(expectSameDisplay('__b__ and **c**', { underline: false })).toBe('<b>b</b> and <b>c</b>');
    });

    it("spoilerMode 'strict' leaves a whitespace-padded spoiler literal", () => {
        expect(expectSameDisplay('|| x || and ||y||', { spoilerMode: 'strict' })).toBe(
            '|| x || and <tg-spoiler>y</tg-spoiler>'
        );
    });
});

describe('toRichMarkdown: everything else stays byte-identical', () => {
    it.each([
        ['code span', 'use `__init__` and `**x**`'],
        ['fenced block', '```js\nconst a = **b** || __c__;\n```'],
        ['indented code', 'para\n\n    **not bold**'],
        ['escapes', '\\_\\_escaped\\_\\_ and \\*\\*x\\*\\*'],
        ['intraword underscores', 'snake__case__name'],
        ['autolink with underscores', 'https://a.com/__init__.py and <https://b.com/__x__>'],
        ['table', '| a | b |\n| :-- | --: |\n| $x^2$ | `c` |'],
        ['math and marks', '公式 $E = mc^2$, $$x^2$$, ==mark==, a==b, [^1]'],
        ['links and images', '[label](https://a.com "title") ![alt **x**](https://a.com/i.png)'],
        ['known html tags', 'a <b>b</b> <i>i</i> <code>c</code> <a href="https://a.com">l</a> <br/> x'],
        ['html list block', '<ul>\n  <li><b>一</b>：说明</li>\n  <li>二</li>\n</ul>'],
        ['pre html block', '<pre><code class="language-python">print("**hi**")</code></pre>'],
        ['task list and hr', '- [x] done\n- [ ] todo\n\n---'],
    ])('%s', (_name, input) => {
        expect(expectSameDisplay(input)).toBe(input);
    });

    it('<details> keeps its tags; markdown inside is rewritten like the walker reads it', () => {
        const input = '<details>\n<summary>__S__</summary>\n\n**body** ||sp||\n\n</details>\n\nafter **x**';
        expect(expectSameDisplay(input)).toBe(
            '<details>\n<summary><u>S</u></summary>\n\n<b>body</b> <tg-spoiler>sp</tg-spoiler>\n\n</details>\n\nafter <b>x</b>'
        );
    });

    it('<details> on one line and inside a quote', () => {
        expect(expectSameDisplay('<details><summary>一行</summary>内容 **紧跟**<br>下一行 _斜_</details>')).toBe(
            '<details><summary>一行</summary>内容 <b>紧跟</b><br>下一行 <i>斜</i></details>'
        );
        expect(expectSameDisplay('> <details>\n> **a** <b>x</b>\n> </details>')).toBe(
            '> <details>\n> <b>a</b> <b>x</b>\n> </details>'
        );
    });

    it('a <pre> inside <details> stays opaque', () => {
        const input = '<details>\n<pre>\n**x**\n</pre>\n</details>';
        expect(expectSameDisplay(input)).toBe(input);
    });
});

describe('toRichMarkdown: HTML the package shows literally is escaped', () => {
    it('unknown inline tags, comments and declarations', () => {
        expect(expectSameDisplay('List<String> and <notreal>x</notreal>')).toBe(
            'List&lt;String> and &lt;notreal>x&lt;/notreal>'
        );
        expect(expectSameDisplay('a <!-- c --> b')).toBe('a &lt;!-- c --> b');
        expect(expectSameDisplay('a <foo bar="*x*"> b *y*')).toBe('a &lt;foo bar="\\*x\\*"> b <i>y</i>');
    });

    it('<span class="tg-spoiler"> becomes <tg-spoiler>; other spans stay literal', () => {
        expect(expectSameDisplay('<span class="tg-spoiler">x</span> <span>y</span> z</span>')).toBe(
            '<tg-spoiler>x</tg-spoiler> &lt;span>y&lt;/span> z&lt;/span>'
        );
    });

    it('spoiler spans pair per paragraph, like the renderer', () => {
        expect(expectSameDisplay('<span class="tg-spoiler">a\n\nb</span>')).toBe(
            '<tg-spoiler>a\n\nb&lt;/span>'
        );
    });

    it('an html block led by an unknown tag turns into literal paragraph text', () => {
        expect(expectSameDisplay('<div>**x** _y_</div>\n\npara')).toBe('&lt;div>\\*\\*x\\*\\* \\_y\\_&lt;/div>\n\npara');
        // A line break stays a hard break, except before a line opening a tag
        expect(expectSameDisplay('- item\n  <div>\n  # b_c\n  </div>')).toBe(
            '- item\n  &lt;div>\\\n  \\# b\\_c\n  &lt;/div>'
        );
    });

    it('inside a kept html block only the tag opener is escaped (Telegram reads it as HTML)', () => {
        // The package shows '&lt;' raw inside an html block, Telegram decodes
        // it: the display referee cannot judge this one, so no expectSameDisplay
        expect(toRichMarkdown('<ul>\n<li>List<String></li>\n</ul>')).toBe('<ul>\n<li>List&lt;String></li>\n</ul>');
    });
});

describe('toRichMarkdown: soft line breaks become hard ones', () => {
    it.each([
        ['one\ntwo', 'one\\\ntwo'],
        ['> a\n> b', '> a\\\n> b'],
        ['- c\n  d', '- c\\\n  d'],
        ['trailing space \nnext', 'trailing space\\\nnext'],
        ['**a\nb** c\nd', '<b>a\\\nb</b> c\\\nd'],
        ['<b>a</b>\n<i>b</i>', '<b>a</b>\\\n<i>b</i>'],
        ['# heading\n\npara\n', '# heading\n\npara\n'],
        ['hard  \nbreak and\\\nescaped', 'hard  \nbreak and\\\nescaped'],
        ['```\ncode\nlines\n```\n`inline\ncode`', '```\ncode\nlines\n```\n`inline\ncode`'],
    ])('%j', (input, expected) => {
        expect(expectSameDisplay(input)).toBe(expected);
    });

    it('inside <details> a soft break gets the backslash, a <br> stays', () => {
        expect(expectSameDisplay('<details>\nline1\nline2<br>line3\n</details>')).toBe(
            '<details>\nline1\\\nline2<br>line3\n</details>'
        );
    });

    it('line endings inside a $$ formula stay as written', () => {
        const formula = '$$\nE = mc^2\n$$';
        expect(expectSameDisplay(formula)).toBe(formula);
        expect(toRichMarkdown(formula, { streaming: true })).toBe(formula);
        // A trailing space inside the formula is not trimmed either
        expect(expectSameDisplay('公式：\n\n$$\nE = mc^2 \n$$\n\n后文')).toBe('公式：\n\n$$\nE = mc^2 \n$$\n\n后文');
        expect(expectSameDisplay('行内 $$E=mc^2$$ 后文')).toBe('行内 $$E=mc^2$$ 后文');
    });

    it('a $$ block on its own lines keeps the line endings around it too', () => {
        for (const block of [
            'a\n$$\nx\n$$\nb',
            'a\n$$y$$\nb',
            '> a\n> $$\n> x\n> $$\n> b',
            'a \n$$\nx\n$$  \nb',
        ]) {
            expect(expectSameDisplay(block)).toBe(block);
        }
        // The closing line carries more text: only the opening side is a block edge
        expect(expectSameDisplay('a\n$$\nx\n$$ tail\nb')).toBe('a\n$$\nx\n$$ tail\\\nb');
    });

    it('a $$ formula inside a line keeps the normal hard breaks', () => {
        expect(expectSameDisplay('第一行 $x_1$\n第二行 $$y$$\n第三行')).toBe(
            '第一行 $x_1$\\\n第二行 $$y$$\\\n第三行'
        );
    });

    it('an unpaired $$ keeps the normal hard breaks', () => {
        expect(expectSameDisplay('$$\nx\n$$ and $$\ny')).toBe('$$\nx\n$$ and $$\\\ny');
        expect(toRichMarkdown('$$\nE = mc', { streaming: true })).toBe('$$\\\nE = mc');
    });

    it('streaming frames get the same hard breaks', () => {
        expect(toRichMarkdown('a\nb **c', { streaming: true })).toBe('a\\\nb <b>c</b>');
    });
});

describe('toRichMarkdown: a $$ formula reaches Telegram as written', () => {
    it.each([
        ['spoiler bars inside', '$$\n||x||_2 = 1\n$$\n\n后文'],
        ['asterisks inside', '证明：\n$$\nf(x^*) \\le f(x) \\quad x^* \\in X\n$$\n后文'],
        ['emphasis across a $$ line', '$$\n*a\n$$ *'],
        ['html and a lone $ inside', '> $$\n> ||a|| <b>x</b> $5 List<T>\n> $$\n> after'],
        ['strong crossing the formula', '**a $$x**y$$ b**'],
        ['inline, in a table cell', '| $$a*b*c$$ | x |\n| --- | --- |'],
    ])('%s', (_name, input) => {
        expect(expectSameDisplay(input)).toBe(input);
        expect(toRichMarkdown(input, { streaming: true })).toBe(input);
    });

    it('text around a formula is still rewritten', () => {
        expect(expectSameDisplay('**粗** $$\n||x||\n$$ ||藏||\n下一行')).toBe(
            '<b>粗</b> $$\n||x||\n$$ <tg-spoiler>藏</tg-spoiler>\\\n下一行'
        );
        expect(expectSameDisplay('| $$a*b*c$$ | **x** |\n| --- | --- |')).toBe('| $$a*b*c$$ | <b>x</b> |\n| --- | --- |');
    });

    it('$$ inside a code span is code, not a formula delimiter', () => {
        expect(expectSameDisplay('`$$` 然后 ||a||\n下一行 $$')).toBe('`$$` 然后 <tg-spoiler>a</tg-spoiler>\\\n下一行 $$');
    });
});

describe("toRichMarkdown: a '$' stays only in a formula pair with the very next '$'", () => {
    it.each([
        ['价格$5和$10之间', '价格\\$5和\\$10之间'],
        ['$x^2$ costs $5', '$x^2$ costs \\$5'],
        ['公式 $E = mc^2$', '公式 $E = mc^2$'],
        ['$5 and $10', '\\$5 and \\$10'],
        ['\\$5', '\\$5'],
        ['`$5` and $', '`$5` and \\$'],
        [
            '价格$5和$10之间；公式 $x^2$ costs $5；$5 and $10',
            '价格\\$5和\\$10之间；公式 $x^2$ costs \\$5；\\$5 and \\$10',
        ],
        ['$a$ and $b$', '$a$ and $b$'],
        ['costs $5, $x$ is', 'costs \\$5, $x$ is'],
        // The '$$' run stays and counts as the next '$': neither single pairs
        ['$a$$b$', '\\$a$$b\\$'],
        ['$a $b$ and $ x$', '\\$a $b$ and \\$ x\\$'],
        ['$$E=mc^2$$ and $$', '$$E=mc^2$$ and $$'],
        ['**$5** and $6', '<b>\\$5</b> and \\$6'],
    ])('%j', (input, expected) => {
        expect(expectSameDisplay(input)).toBe(expected);
    });

    it('every single $ left unescaped outside a $$ formula belongs to a pair with nothing between', () => {
        fc.assert(
            fc.property(
                fc.array(fc.constantFrom('$', '$$', '\\$', '5', 'x', '^2', ' ', '和', '，'), { maxLength: 20 }),
                (parts) => {
                    const output = toRichMarkdown(parts.join(''));
                    // Unescaped '$' runs, in order: singles must come in adjacent pairs
                    const runs = (output.match(/\\\$|\$+/g) ?? []).filter((token) => token !== '\\$');
                    // '$$' runs pair in order; a formula is passed through untouched
                    const doubles = runs.flatMap((run, position) => (run === '$$' ? [position] : []));
                    const insideFormula = (position: number): boolean =>
                        doubles.some((opener, pair) => pair % 2 === 0 && (doubles[pair + 1] ?? -1) > position && opener < position);
                    let index = 0;
                    while (index < runs.length) {
                        if (runs[index] === '$' && !insideFormula(index)) {
                            expect(runs[index + 1], output).toBe('$');
                            index += 2;
                        } else {
                            index += 1;
                        }
                    }
                }
            ),
            { numRuns: 500 }
        );
    });
});

describe('toRichMarkdown: autolinks stay byte-identical', () => {
    it.each([
        ['bare URL with $', '用 https://graph.microsoft.com/v1.0/me/messages?$select=subject 即可'],
        ['angle autolink with $', '<https://api.example.com/odata/People?$top=2>'],
        ['www literal with $ and underscores', 'www.example.com/a?$b=1&c=__x__'],
        ['angle autolink with markup-like text', '<https://a.com/||x||/*y*>'],
    ])('%s', (_name, input) => {
        expect(expectSameDisplay(input)).toBe(input);
    });

    it('text outside the autolink is still rewritten; a [label] link keeps its edits', () => {
        expect(expectSameDisplay('www.example.com/a?$b=1 和 $5')).toBe('www.example.com/a?$b=1 和 \\$5');
        expect(expectSameDisplay('[价格 $5 **粗**](https://a.com/?$x=1) 与 $3')).toBe(
            '[价格 \\$5 <b>粗</b>](https://a.com/?$x=1) 与 \\$3'
        );
    });

    it('a line ending in a bare URL gets the two-space hard break, not a backslash', () => {
        expect(expectSameDisplay('见 https://a.com/__init__.py\n下一行')).toBe('见 https://a.com/__init__.py  \n下一行');
        expect(expectSameDisplay('见 https://a.com/x \n下一行')).toBe('见 https://a.com/x  \n下一行');
        expect(expectSameDisplay('<https://a.com/x>\n下一行')).toBe('<https://a.com/x>\\\n下一行');
    });
});

describe('toRichMarkdown: a raw <pre> block keeps no blank line', () => {
    it.each([
        ['top level', '示例：\n\n<pre>\nint a = 1;\n\nint b = 2;\n</pre>', '示例：\n\n<pre>\nint a = 1;&#10;\nint b = 2;\n</pre>'],
        ['several blank lines, one with spaces', '<pre>a\n\n\n  \nb</pre>\n\n后文', '<pre>a&#10;&#10;&#10;\nb</pre>\n\n后文'],
        ['in a list item', '- 项\n\n  <pre>\n  x\n\n  y\n  </pre>', '- 项\n\n  <pre>\n  x&#10;\n  y\n  </pre>'],
        ['in a quote', '> <pre>\n> x\n>\n> y\n> </pre>\n\n后文', '> <pre>\n> x&#10;\n> y\n> </pre>\n\n后文'],
        ['with a language', '<pre><code class="language-c">a;\n\nb;</code></pre>', '<pre><code class="language-c">a;&#10;\nb;</code></pre>'],
    ])('%s', (_name, input, expected) => {
        const output = toRichMarkdown(input);
        expect(output).toBe(expected);
        // Inside the <pre> block no line is blank any more
        const block = output.slice(output.indexOf('<pre'), output.indexOf('</pre>') + '</pre>'.length);
        for (const line of block.split('\n')) expect(line.replace(/^[ >]*/, '').trim()).not.toBe('');
    });

    it('streaming frames get the same treatment', () => {
        expect(toRichMarkdown('示例：\n\n<pre>\nint a = 1;\n\nint b = 2;', { streaming: true })).toBe(
            '示例：\n\n<pre>\nint a = 1;&#10;\nint b = 2;\n</pre>'
        );
    });

    it('other html blocks and a pre without blank lines stay as written', () => {
        for (const input of ['<pre>\nno blank\n</pre>', '<ul>\n<li>a</li>\n</ul>', '<b>\nx\n</b>']) {
            expect(toRichMarkdown(input)).toBe(input);
        }
    });
});

describe('toRichMarkdown: streaming', () => {
    it.each([
        ['abc __und', 'abc <u>und</u>'],
        ['x || spo', 'x <tg-spoiler> spo</tg-spoiler>'],
        ['open **bol', 'open <b>bol</b>'],
        ['```js\nconst a', '```js\nconst a\n```'],
        ['see [li](https://exa', 'see li'],
        ['a <b>bold', 'a <b>bold</b>'],
        ['<pre>\ncode', '<pre>\ncode\n</pre>'],
        ['<details>\n<summary>S</summary>\n\nbody', '<details>\n<summary>S</summary>\n\nbody\n</details>'],
        ['<details>\n<summary>S</summary>\n\nhello <b', '<details>\n<summary>S</summary>\n\nhello \n</details>'],
        ['这是||', '这是||'],
        ['行内 `', '行内 `'],
        ['~~', '~~'],
    ])('%j', (input, expected) => {
        expect(toRichMarkdown(input, { streaming: true })).toBe(expected);
    });

    it('a complete document passes through as in strict mode', () => {
        const input = '**a** __b__ `c`\n\n```\nx\n```\n\n<details>\nd\n</details>';
        expect(toRichMarkdown(input, { streaming: true })).toBe(toRichMarkdown(input));
    });
});
