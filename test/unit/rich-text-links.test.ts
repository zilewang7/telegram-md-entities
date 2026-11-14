import { describe, expect, it } from 'vitest';
import { renderMarkdown, styleSegments, toRichMarkdown } from '../../src/index';
import type { TextLink, TextLinkContext, TextLinker } from '../../src/index';

const urlOf = (digits: string): string => `https://t.me/c/42/${100 + Number(digits)}`;

/** '#N' context references, as a bot links them: the run's neighbours count for the boundaries */
const hashLinker: TextLinker = (text, { before, after }) =>
    [...`${before}${text}${after}`.matchAll(/(?<![\w#])#(\d{1,3})(?![\w-])/g)]
        .map((match) => ({ offset: (match.index ?? 0) - before.length, length: match[0].length, url: urlOf(match[1] ?? '0') }))
        .filter((link) => link.offset >= 0 && link.offset + link.length <= text.length);

/** Every ASCII word: ranges that start and end with letters, unlike '#N' */
const wordLinker: TextLinker = (text) =>
    [...text.matchAll(/[A-Za-z]{2,}/g)].map((match) => ({
        offset: match.index ?? 0,
        length: match[0].length,
        url: `https://w.example/${match[0]}`,
    }));

const anchor = (label: string): string => `<a href="${urlOf(label.slice(1))}">${label}</a>`;

/** The link texts renderMarkdown sees in the output */
const linkTextsOf = (markdown: string): string[] => {
    const rendered = renderMarkdown(markdown);
    return rendered.entities
        .filter((entity) => entity.type === 'text_link')
        .map((entity) => rendered.text.slice(entity.offset, entity.offset + entity.length));
};

const isAddedLink = (url: string | undefined): boolean =>
    url !== undefined && (url.startsWith('https://t.me/c/42/') || url.startsWith('https://w.example/'));

/**
 * Links only add text_link entities: without them, the output shows what
 * the output without textLinks shows
 */
const expectOnlyLinksAdded = (markdown: string, linker: TextLinker = hashLinker, streaming = false): string => {
    const linkedSource = toRichMarkdown(markdown, { streaming, textLinks: linker });
    const linked = renderMarkdown(linkedSource);
    const plain = renderMarkdown(toRichMarkdown(markdown, { streaming }));
    expect(linked.text).toBe(plain.text);
    const withoutAdded = {
        text: linked.text,
        entities: linked.entities.filter((entity) => entity.type !== 'text_link' || !isAddedLink(entity.url)),
    };
    expect(styleSegments(withoutAdded)).toEqual(styleSegments(plain));
    return linkedSource;
};

describe('toRichMarkdown textLinks: plain text gets the links', () => {
    it.each([
        ['a paragraph', '见 #1 和 #2', `见 ${anchor('#1')} 和 ${anchor('#2')}`],
        ['the start of a line', '#3 说得对', `${anchor('#3')} 说得对`],
        ['a list item and a nested one', '- 跳转：#1\n  - 子项 #2', `- 跳转：${anchor('#1')}\n  - 子项 ${anchor('#2')}`],
        ['quote lines', '> 引用 #1\n> 第二行 #2', `> 引用 ${anchor('#1')}\\\n> 第二行 ${anchor('#2')}`],
        ['a heading', '## 关于 #4', `## 关于 ${anchor('#4')}`],
        ['a task list', '- [x] 核对 #1', `- [x] 核对 ${anchor('#1')}`],
        ['a line with trailing blanks', '行尾 #1 \n下一行 #2', `行尾 ${anchor('#1')}\\\n下一行 ${anchor('#2')}`],
        [
            'styled text',
            '**#1**是 _#2_ ~~#3~~ ||#4||',
            `<b>${anchor('#1')}</b>是 <i>${anchor('#2')}</i> <s>${anchor('#3')}</s> <tg-spoiler>${anchor('#4')}</tg-spoiler>`,
        ],
        ['inside an html tag the package knows', '<b>#1</b>', `<b>${anchor('#1')}</b>`],
        ['a reference link brackets without a definition', '[#1] 见', `[${anchor('#1')}] 见`],
        // Only the forward pass places this #2: the backward one stops at the escape
        ['a list continuation line with an escape after it', '- 第一行\n  见 #2 \\* 尾', `- 第一行\\\n  见 ${anchor('#2')} \\* 尾`],
        // Only the backward pass places this #1: the forward one stops at the reference
        // One trailing blank: a soft break (two would be a hard break already)
        ['a line with a character reference before it', '&amp; 行尾 #1 \n下一行', `&amp; 行尾 ${anchor('#1')}\\\n下一行`],
        ['a character reference right before it', '&amp;#1 见', `&amp;${anchor('#1')} 见`],
    ])('%s', (_name, input, expected) => {
        expect(expectOnlyLinksAdded(input)).toBe(expected);
        expect(linkTextsOf(expected).length).toBeGreaterThan(0);
    });

    it('a table cell', () => {
        // The package renders a table as a monospace grid without links, so
        // only the output is compared
        expect(toRichMarkdown('| a | b |\n| --- | --- |\n| #1 | **#2** |', { textLinks: hashLinker })).toBe(
            `| a | b |\n| --- | --- |\n| ${anchor('#1')} | <b>${anchor('#2')}</b> |`
        );
    });

    it('a <details> element: summary, body and a list in it', () => {
        const input = '<details><summary>关于 #1</summary>\n\n正文 #2\n\n1. 列表里 #3\n\n</details>';
        expect(expectOnlyLinksAdded(input)).toBe(
            `<details><summary>关于 ${anchor('#1')}</summary>\n\n正文 ${anchor('#2')}\n\n1. 列表里 ${anchor('#3')}\n\n</details>`
        );
    });

    it('a <details> element on one line', () => {
        expect(expectOnlyLinksAdded('<details><summary>S</summary>内容 #1<br>下一行 #2</details>')).toBe(
            `<details><summary>S</summary>内容 ${anchor('#1')}<br>下一行 ${anchor('#2')}</details>`
        );
    });

    it('a streaming frame, with the tail still open', () => {
        expect(expectOnlyLinksAdded('正在说 #1 和 **#2', hashLinker, true)).toBe(
            `正在说 ${anchor('#1')} 和 <b>${anchor('#2')}</b>`
        );
    });

    it('text after an escape or a character reference on the same line', () => {
        expect(expectOnlyLinksAdded('\\*注意\\* #1 和 &amp; #2')).toBe(`\\*注意\\* ${anchor('#1')} 和 &amp; ${anchor('#2')}`);
    });

    it('text after a closed html anchor or code element', () => {
        expect(expectOnlyLinksAdded('<a href="https://b.com">见 **#1**</a> 后 #2 <code>#3</code> 再 #4')).toBe(
            `<a href="https://b.com">见 <b>#1</b></a> 后 ${anchor('#2')} <code>#3</code> 再 ${anchor('#4')}`
        );
    });
});

/** The output with the added <a> tags taken out: what the output without links is */
const withoutAddedAnchors = (markdown: string): string =>
    markdown.replace(/<a href="https:\/\/(?:t\.me\/c\/42|w\.example)\/[^"]*">([^<]*)<\/a>/g, '$1');

describe('toRichMarkdown textLinks: what is next to a link stays as written', () => {
    // Telegram pairs these runs the same with or without the tags (measured);
    // this package's parser reads the tags as punctuation, so its display
    // referee does not apply here: only the tags are checked
    it.each([
        ['a ~ between two links (a from-to range)', '范围 #12~#15 提到，大约 3~5 天能到', `范围 ${anchor('#12')}~${anchor('#15')} 提到，大约 3~5 天能到`],
        ['** after a link', '见 #1**"引用"**', `见 ${anchor('#1')}**"引用"**`],
        ['a run between links', '见 #7**#8**#9', `见 ${anchor('#7')}**${anchor('#8')}**${anchor('#9')}`],
        ['~~ after a link', '见 #1~~#2~~', `见 ${anchor('#1')}~~${anchor('#2')}~~`],
        ['a == highlight around a link', '==重点 #1== 的说法', `==重点 ${anchor('#1')}== 的说法`],
    ])('%s', (_name, input, expected) => {
        const output = toRichMarkdown(input, { textLinks: hashLinker });
        expect(output).toBe(expected);
        expect(withoutAddedAnchors(output)).toBe(toRichMarkdown(input));
    });

    it('words of a word linker keep their underscores as written', () => {
        const output = toRichMarkdown('use snake_case here', { textLinks: wordLinker });
        expect(output).toBe(
            '<a href="https://w.example/use">use</a> <a href="https://w.example/snake">snake</a>_<a href="https://w.example/case">case</a> ' +
                '<a href="https://w.example/here">here</a>'
        );
        expect(withoutAddedAnchors(output)).toBe('use snake_case here');
    });

    it('a delimiter that belongs to a construct becomes a tag', () => {
        expect(expectOnlyLinksAdded('**#1**')).toBe(`<b>${anchor('#1')}</b>`);
    });

    it('a link at the start of a line needs no escape for its #: the tag keeps the line from being a heading', () => {
        expect(expectOnlyLinksAdded('#3 说得对\n#4 也是\n#标签 没有链接')).toBe(
            `${anchor('#3')} 说得对\\\n${anchor('#4')} 也是\\\n\\#标签 没有链接`
        );
    });
});

describe('toRichMarkdown textLinks: what stays as written', () => {
    it.each([
        ['a code span', '不是 `#1`'],
        ['a fenced block', '```\n#1\n```'],
        ['a link label', '[见 #1](https://a.com)'],
        ['styled text inside a link label', '[**#1** _#2_ ~~#3~~ ||#4||](https://a.com)'],
        ['a reference link', '[见 #1][r]\n\n[r]: https://a.com'],
        ['a bare URL', 'https://a.com/#1'],
        ['an autolink', '<https://a.com/#1>'],
        ['an html anchor', '<a href="https://b.com">见 #1</a>'],
        ['an html code element', '见 <code>#1</code> 和 <pre>#2</pre>'],
        ['an escaped #', '转义 \\#1'],
        ['an escaped backslash right before', '路径 \\\\#1'],
        ['a character reference', '引用 &#35;1'],
        ['a $…$ formula', '公式 $#1$'],
        ['a $$…$$ formula', '公式 $$#1$$'],
        ['an image alt', '![#1](https://a.com/i.png)'],
        ['a raw html block', '<div>\n#1\n</div>'],
        ['a reference glued to a word before it', '**Alice**#1 说过'],
        ['a reference glued to a word after it', '#1`code` 和 #1**2**'],
    ])('%s', (_name, input) => {
        expect(toRichMarkdown(input, { textLinks: hashLinker })).toBe(toRichMarkdown(input));
    });

    it('text after a closed html anchor is linked again', () => {
        expect(expectOnlyLinksAdded('<a href="https://b.com">#1</a> 然后 #2')).toBe(
            `<a href="https://b.com">#1</a> 然后 ${anchor('#2')}`
        );
    });

    it('the rest of the line after an escape still links', () => {
        expect(expectOnlyLinksAdded('转义 \\#1 字符引用 &#35;2 结尾 #5')).toBe(
            `转义 \\#1 字符引用 &#35;2 结尾 ${anchor('#5')}`
        );
    });

    it('the linker sees what is around its run', () => {
        const seen: [string, TextLinkContext][] = [];
        toRichMarkdown('a **b** c`d`e <i>f</i>g', {
            textLinks: (text, context) => {
                seen.push([text, context]);
                return [];
            },
        });
        expect(seen).toEqual([
            ['a ', { before: '', after: 'b' }],
            ['b', { before: ' ', after: ' ' }],
            [' c', { before: 'b', after: 'd' }],
            ['e ', { before: 'd', after: 'f' }],
            ['f', { before: ' ', after: 'g' }],
            ['g', { before: 'f', after: '' }],
        ]);
    });

    // What the package shows there: 'a[1]#1', 'xa#1', 'x</span>#1', 'alt#1',
    // 'https://a.com/i.png#1', '见 (./relative)#1'
    it.each([
        ['a footnote reference', 'a[^1]#1\n\n[^1]: 注', ']'],
        ['a spoiler span it closes', 'x<span class="tg-spoiler">a</span>#1', 'a'],
        ['a stray </span>, shown as text', 'x</span>#1', '>'],
        ['an image by reference', '![alt][r]#1\n\n[r]: https://a.com/i.png', 't'],
        ['an image without alt (its url shows)', '![](https://a.com/i.png)#1', 'g'],
        ['a link Telegram cannot open (its target shows)', '[见](./relative)#1', ')'],
    ])('the character before a run is the one a reader sees: %s', (_name, input, before) => {
        const seen: string[] = [];
        toRichMarkdown(input, {
            textLinks: (text, context) => {
                if (text.startsWith('#1')) seen.push(context.before);
                return [];
            },
        });
        expect(seen).toEqual([before]);
    });
});

describe('toRichMarkdown textLinks: what the linker gets wrong is ignored', () => {
    const fixed =
        (links: unknown): TextLinker =>
        // A plain JavaScript caller can return anything
        () =>
            links as readonly TextLink[];

    it.each([
        ['a url with a scheme it cannot be', 'javascript:alert(1)'],
        ['a relative url', '/c/42/101'],
        ['an http url without a host', 'https:x'],
        ['a url with a quote', 'https://a.com/"x'],
        ['a url with &', 'https://a.com/?a=1&b=2'],
        ['a url with a space', 'https://a.com/a b'],
        ['a url with a no-break space', 'https://a.com/a\u00a0b'],
        ['a url with a line separator', 'https://a.com/a\u2028b'],
        ['a url with a control character', 'https://a.com/a\u0085b'],
        ['a url with |', 'https://a.com/a|b'],
        ['a url with a backtick', 'https://a.com/a`b'],
        ['a url with <', 'https://a.com/a<b'],
        ['a url with a backslash', 'https://a.com/a\\b'],
        ['a url with $', 'https://a.com/?$top=1'],
    ])('%s', (_name, url) => {
        expect(toRichMarkdown('word here', { textLinks: fixed([{ offset: 0, length: 4, url }]) })).toBe('word here');
    });

    it('a tg url and an http url with a path pass', () => {
        expect(toRichMarkdown('word here', { textLinks: fixed([{ offset: 0, length: 4, url: 'tg://resolve?domain=x' }]) })).toBe(
            '<a href="tg://resolve?domain=x">word</a> here'
        );
        expect(
            toRichMarkdown('word here', { textLinks: fixed([{ offset: 5, length: 4, url: 'https://a.com/p/q?x=1#y' }]) })
        ).toBe('word <a href="https://a.com/p/q?x=1#y">here</a>');
    });

    it.each([
        ['a negative offset', { offset: -1, length: 2 }],
        ['an empty range', { offset: 0, length: 0 }],
        ['a range past the end', { offset: 5, length: 10 }],
        ['a fractional offset', { offset: 0.5, length: 2 }],
        ['a NaN length', { offset: 0, length: Number.NaN }],
        ['an offset that is a string', { offset: '0', length: 2 }],
    ])('%s', (_name, range) => {
        expect(toRichMarkdown('abcd efgh', { textLinks: fixed([{ ...range, url: 'https://a.com' }]) })).toBe('abcd efgh');
    });

    it.each([
        ['a \\', 'a\\\\b'],
        ['a `', 'a`b'],
        ['a *', 'a*b'],
        ['a _', 'a_b'],
        ['a ~', 'a~b'],
        ['a |', 'a|b'],
        ['a =', 'a=b'],
        ['a $', 'a$b'],
        ['a [', 'a[b'],
        ['a ]', 'a]b'],
        ['a <', 'a<b'],
        ['a >', 'a>b'],
        ['a &', 'a&b'],
    ])('a range holding %s', (_name, input) => {
        const linker: TextLinker = (text) => [{ offset: 0, length: text.length, url: 'https://a.com' }];
        expect(toRichMarkdown(input, { textLinks: linker })).toBe(toRichMarkdown(input));
    });

    it('a range over a soft line break', () => {
        expect(toRichMarkdown('one\ntwo', { textLinks: fixed([{ offset: 2, length: 3, url: 'https://a.com' }]) })).toBe(
            'one\\\ntwo'
        );
    });

    it('a range that splits a surrogate pair', () => {
        expect(toRichMarkdown('a😀b', { textLinks: fixed([{ offset: 2, length: 2, url: 'https://a.com' }]) })).toBe('a😀b');
        expect(toRichMarkdown('😀ab', { textLinks: fixed([{ offset: 1, length: 2, url: 'https://a.com' }]) })).toBe('😀ab');
        expect(toRichMarkdown('a😀b', { textLinks: fixed([{ offset: 1, length: 2, url: 'https://a.com' }]) })).toBe(
            'a<a href="https://a.com">😀</a>b'
        );
    });

    it('a linker that throws, returns no array, or returns junk links nothing and does not throw', () => {
        const throwing: TextLinker = () => {
            throw new Error('boom');
        };
        const throwingGetter = {
            get offset(): number {
                throw new Error('boom');
            },
            length: 2,
            url: 'https://a.com',
        };
        for (const linker of [throwing, fixed(undefined), fixed(null), fixed([null]), fixed([42]), fixed([throwingGetter])]) {
            expect(toRichMarkdown('见 #1 和 **#2**', { textLinks: linker })).toBe('见 #1 和 <b>#2</b>');
        }
    });

    it('overlapping ranges: the one that starts first wins, whatever the array order', () => {
        const ranges = [
            { offset: 2, length: 4, url: 'https://a.com/2' },
            { offset: 0, length: 4, url: 'https://a.com/1' },
        ];
        expect(toRichMarkdown('abcdef', { textLinks: fixed(ranges) })).toBe('<a href="https://a.com/1">abcd</a>ef');
        expect(toRichMarkdown('abcdef', { textLinks: fixed([...ranges].reverse()) })).toBe(
            '<a href="https://a.com/1">abcd</a>ef'
        );
    });

    it('a range whose first character comes out of a character reference', () => {
        // '&#59;' is ';' in the value; its source must not be cut in half
        const semicolonLinker: TextLinker = (text) => {
            const at = text.indexOf(';b');
            return at === -1 ? [] : [{ offset: at, length: 2, url: 'https://a.com' }];
        };
        expect(toRichMarkdown('a&#59;b', { textLinks: semicolonLinker })).toBe('a&#59;b');
        expect(toRichMarkdown('&#59;b', { textLinks: semicolonLinker })).toBe('&#59;b');
    });
});
