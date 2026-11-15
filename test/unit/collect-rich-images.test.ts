import { describe, expect, it } from 'vitest';
import {
    collectRichImages,
    renderMarkdown,
    styleSegments,
    toRichMarkdown,
    validateMessage,
} from '../../src/index';
import type { RichImageRef } from '../../src/index';

/** Every reported range must cut exactly the image syntax out of the source */
const expectRangesAreSyntax = (markdown: string, refs: RichImageRef[]): void => {
    for (const ref of refs) {
        const syntax = markdown.slice(ref.start, ref.end);
        expect(syntax.startsWith('!')).toBe(true);
        expect(syntax.endsWith(')') || syntax.endsWith(']')).toBe(true);
    }
};

/** Replace every image by its index, right to left so earlier offsets stay valid */
const replaceImages = (markdown: string): string => {
    let output = markdown;
    for (const ref of [...collectRichImages(markdown)].reverse()) {
        output = `${output.slice(0, ref.start)}[图片${ref.index + 1}]${output.slice(ref.end)}`;
    }
    return output;
};

describe('collectRichImages: standalone images', () => {
    it('reports a top-level image paragraph as a block image', () => {
        const markdown = '![](https://example.com/a.png)';
        const refs = collectRichImages(markdown);
        expect(refs).toEqual([
            {
                index: 0,
                url: 'https://example.com/a.png',
                alt: '',
                start: 0,
                end: markdown.length,
                block: true,
            },
        ]);
        expectRangesAreSyntax(markdown, refs);
    });

    it('keeps the title when the image carries one', () => {
        const markdown = '![alt text](https://example.com/a.png "the title")';
        expect(collectRichImages(markdown)).toEqual([
            {
                index: 0,
                url: 'https://example.com/a.png',
                alt: 'alt text',
                title: 'the title',
                start: 0,
                end: markdown.length,
                block: true,
            },
        ]);
    });

    it('returns a url verbatim: bot-internal refs, relative refs, empty alt', () => {
        expect(collectRichImages('![](g1/img1/s1/#12)')).toMatchObject([
            { index: 0, url: 'g1/img1/s1/#12', alt: '', block: true },
        ]);
        expect(collectRichImages('![](./images/a.png)')).toMatchObject([{ url: './images/a.png' }]);
        expect(collectRichImages('![](https://example.com/a.png "t")')).toMatchObject([{ alt: '' }]);
    });

    it('numbers image nodes in source order and marks each lone paragraph image as a block', () => {
        const refs = collectRichImages('![](one.png)\n\n中间\n\n![](two.png)\n\n![](three.png)');
        expect(refs.map((ref) => [ref.index, ref.url, ref.block])).toEqual([
            [0, 'one.png', true],
            [1, 'two.png', true],
            [2, 'three.png', true],
        ]);
    });
});

describe('collectRichImages: images among other content', () => {
    it('reports inline images as non-block', () => {
        const markdown = '看这个 ![pic](https://x.example/y.png) 好看';
        expect(collectRichImages(markdown)).toEqual([
            {
                index: 0,
                url: 'https://x.example/y.png',
                alt: 'pic',
                start: 4,
                end: 35,
                block: false,
            },
        ]);
    });

    it('reports every image of a paragraph that has more than one as non-block', () => {
        const refs = collectRichImages('![](a.png) ![](b.png)');
        expect(refs.map((ref) => [ref.url, ref.block])).toEqual([
            ['a.png', false],
            ['b.png', false],
        ]);
    });

    it('reports images inside quotes, lists and tables as non-block', () => {
        const quote = '> ![](q.png)';
        const quoteRefs = collectRichImages(quote);
        expect(quoteRefs.map((ref) => [ref.url, ref.block])).toEqual([['q.png', false]]);
        expect(quote.slice(quoteRefs[0]?.start, quoteRefs[0]?.end)).toBe('![](q.png)');

        expect(collectRichImages('- ![](l.png)').map((ref) => [ref.url, ref.block])).toEqual([['l.png', false]]);
        expect(collectRichImages('1. 项目\n   ![](l2.png)').map((ref) => [ref.url, ref.block])).toEqual([
            ['l2.png', false],
        ]);
        expect(collectRichImages('| a |\n| - |\n| ![](t.png) |').map((ref) => [ref.url, ref.block])).toEqual([
            ['t.png', false],
        ]);
    });

    it('reports images inside headings, emphasis and links as non-block', () => {
        expect(collectRichImages('## ![](h.png)').map((ref) => [ref.url, ref.block])).toEqual([['h.png', false]]);
        expect(collectRichImages('*![](em.png)*').map((ref) => [ref.url, ref.block])).toEqual([['em.png', false]]);
        expect(collectRichImages('[![alt](img.png)](https://target)').map((ref) => [ref.url, ref.block])).toEqual([
            ['img.png', false],
        ]);
    });

    it('reports images inside a <details> element as non-block, at their real source offsets', () => {
        const markdown = '<details>\n<summary>说明</summary>\n\n前<br>![](in.png) 后\n\n</details>';
        const refs = collectRichImages(markdown);
        expect(refs).toHaveLength(1);
        expect(refs[0]).toMatchObject({ index: 0, url: 'in.png', alt: '', block: false });
        expect(markdown.slice(refs[0]?.start, refs[0]?.end)).toBe('![](in.png)');
    });

    it('reports images in a <details> body written on the tag line', () => {
        const markdown = '<details><summary>s</summary>看 ![](in.png) 图</details>';
        const refs = collectRichImages(markdown);
        expect(refs.map((ref) => [ref.url, ref.block])).toEqual([['in.png', false]]);
        expect(markdown.slice(refs[0]?.start, refs[0]?.end)).toBe('![](in.png)');
    });

    it('reports images in a <details> element nested in a quote', () => {
        const markdown = '> <details>\n> <summary>s</summary>\n>\n> ![](in.png)\n> </details>';
        const refs = collectRichImages(markdown);
        expect(refs.map((ref) => [ref.url, ref.block])).toEqual([['in.png', false]]);
        expect(markdown.slice(refs[0]?.start, refs[0]?.end)).toBe('![](in.png)');
    });
});

describe('collectRichImages: code and raw HTML hold no images', () => {
    it.each([
        ['fenced code', '```\n![](no.png)\n```'],
        ['tilde fence', '~~~\n![](no.png)\n~~~'],
        ['fence with info string', '```md\n![](no.png)\n```'],
        ['inline code', 'the `![](no.png)` span'],
        ['indented code', 'para\n\n    ![](no.png)'],
        ['raw <img> tag', '<img src="no.png">'],
        ['inline escaped bang', '\\![](not-an-image.png)'],
    ])('%s', (_name, markdown) => {
        expect(collectRichImages(markdown)).toEqual([]);
    });
});

describe('collectRichImages: reference-style images', () => {
    it('resolves the definition url and title, keeping the reference syntax as the range', () => {
        const markdown = '![alt][id]\n\n[id]: https://example.com/ref.png "ref title"';
        const refs = collectRichImages(markdown);
        expect(refs).toEqual([
            {
                index: 0,
                url: 'https://example.com/ref.png',
                alt: 'alt',
                title: 'ref title',
                start: 0,
                end: 10,
                block: true,
            },
        ]);
        expect(markdown.slice(refs[0]?.start, refs[0]?.end)).toBe('![alt][id]');
    });

    it('resolves collapsed and shortcut references too', () => {
        expect(collectRichImages('![alt][]\n\n[alt]: https://example.com/c.png')).toMatchObject([
            { url: 'https://example.com/c.png', alt: 'alt', block: true },
        ]);
        expect(collectRichImages('![alt]\n\n[alt]: https://example.com/c.png')).toMatchObject([
            { url: 'https://example.com/c.png', alt: 'alt' },
        ]);
    });

    it('resolves a definition living inside a container', () => {
        expect(collectRichImages('![a][id]\n\n> [id]: https://example.com/q.png')).toMatchObject([
            { url: 'https://example.com/q.png', alt: 'a', block: true },
        ]);
    });

    it('reports no image when no definition resolves the reference (it stays text)', () => {
        expect(collectRichImages('![alt][missing]')).toEqual([]);
    });
});

describe('collectRichImages: alt text as the parser reads it', () => {
    it('keeps CJK alt text', () => {
        expect(collectRichImages('![中文 说明](u.png)')).toMatchObject([{ alt: '中文 说明' }]);
    });

    it('resolves markdown escapes in alt text', () => {
        expect(collectRichImages('![a\\*b](u.png)')).toMatchObject([{ alt: 'a*b' }]);
        expect(collectRichImages('![a\\]b](u.png)')).toMatchObject([{ alt: 'a]b' }]);
    });

    it('resolves escapes and character references in the url, as the renderer reads it', () => {
        expect(collectRichImages('![a](https://example.com/a\\(b\\).png)')).toMatchObject([
            { url: 'https://example.com/a(b).png' },
        ]);
        expect(collectRichImages('![a](https://example.com/a&amp;b.png)')).toMatchObject([
            { url: 'https://example.com/a&b.png' },
        ]);
    });
});

describe('collectRichImages: offsets and stability', () => {
    it.each([[''], ['   \n\n'], ['plain text only']])('no image in %j', (markdown) => {
        expect(collectRichImages(markdown)).toEqual([]);
    });

    it('reports UTF-16 offsets, counting a surrogate pair as two units', () => {
        const markdown = '😀![](emoji.png)';
        const refs = collectRichImages(markdown);
        expect(refs).toMatchObject([{ start: 2, end: markdown.length }]);
        expect(markdown.slice(refs[0]?.start, refs[0]?.end)).toBe('![](emoji.png)');
    });

    it('cuts exactly the image syntax out of a document that uses every container', () => {
        const markdown = [
            '开头',
            '',
            '![](g1/img1/s1/#12)',
            '',
            '文字 ![说明](g2/img2/s2/#13 "标题") 混排',
            '',
            '> 引用 ![](g3/img3/s3/#14)',
            '',
            '- 列表 ![](g4/img4/s4/#15)',
            '',
            '| 表格 |',
            '| --- |',
            '| ![](g5/img5/s5/#16) |',
            '',
            '# 标题 ![](g6/img6/s6/#17)',
            '',
            '<details><summary>s</summary>折叠 ![](g7/img7/s7/#18)</details>',
            '',
        ].join('\n');
        const refs = collectRichImages(markdown);
        expect(refs.map((ref) => [ref.index, ref.url, ref.block])).toEqual([
            [0, 'g1/img1/s1/#12', true],
            [1, 'g2/img2/s2/#13', false],
            [2, 'g3/img3/s3/#14', false],
            [3, 'g4/img4/s4/#15', false],
            [4, 'g5/img5/s5/#16', false],
            [5, 'g6/img6/s6/#17', false],
            [6, 'g7/img7/s7/#18', false],
        ]);
        expect(refs[1]?.title).toBe('标题');
        expectRangesAreSyntax(markdown, refs);
        for (const ref of refs) expect(markdown.slice(ref.start, ref.end)).toContain(ref.url);
    });

    it('is stable across calls and leaves the input untouched', () => {
        const markdown = 'a ![](x.png) b\n\n> ![](y.png)\n';
        expect(collectRichImages(markdown)).toEqual(collectRichImages(markdown));
        expect(markdown).toBe('a ![](x.png) b\n\n> ![](y.png)\n');
    });
});

describe('collectRichImages: offsets align with what toRichMarkdown rewrites', () => {
    it('replaces block and inline images without leaving image syntax behind', () => {
        const markdown = '开头\n\n![](g1/img1/s1/#12)\n\n中间 ![说明](g2/img2/s2/#13) 结尾\n';
        const replaced = replaceImages(markdown);
        expect(replaced).toBe('开头\n\n[图片1]\n\n中间 [图片2] 结尾\n');

        const rendered = renderMarkdown(replaced);
        expect(rendered.text).not.toContain('g1/img1');
        expect(rendered.text).toContain('[图片1]');
        expect(validateMessage(rendered)).toEqual([]);

        // The package's own rich rewrite still reads the replaced source the same way
        expect(styleSegments(renderMarkdown(toRichMarkdown(replaced)))).toEqual(styleSegments(renderMarkdown(replaced)));
    });

    it('replaces images inside quotes and details while keeping the containers intact', () => {
        const markdown = '> ![](g1/img1/s1/#12)\n\n<details>\n<summary>说明</summary>\n\n前<br>![](g2/img2/s2/#13) 后\n\n</details>\n';
        const replaced = replaceImages(markdown);
        expect(replaced).toBe('> [图片1]\n\n<details>\n<summary>说明</summary>\n\n前<br>[图片2] 后\n\n</details>\n');

        const rich = toRichMarkdown(replaced);
        expect(rich).toContain('<details>');
        expect(rich).toContain('<summary>说明</summary>');
        expect(renderMarkdown(replaced).text).toContain('[图片1]');
        expect(renderMarkdown(replaced).text).toContain('[图片2]');
        expect(validateMessage(renderMarkdown(replaced))).toEqual([]);
    });
});
