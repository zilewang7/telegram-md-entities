import { describe, expect, it } from 'vitest';
import { renderMarkdown, richBlocksToMarkdown, richTextToPlain, validateMessage } from '../../src/index';
import type { RichBlockNode } from '../../src/index';

/** Re-parse referee: output must render into a valid message */
const roundTrip = (blocks: RichBlockNode[]) => {
    const markdown = richBlocksToMarkdown(blocks);
    const rendered = renderMarkdown(markdown);
    expect(validateMessage(rendered)).toEqual([]);
    return { markdown, rendered };
};

const entityTypes = (rendered: { entities: { type: string }[] }): string[] =>
    rendered.entities.map((entity) => entity.type);

describe('richBlocksToMarkdown', () => {
    it('paragraph with nested inline styles', () => {
        const { markdown, rendered } = roundTrip([
            {
                type: 'paragraph',
                text: [
                    '正常 ',
                    { type: 'bold', text: ['加粗带 ', { type: 'italic', text: '斜体' }] },
                    ' 和 ',
                    { type: 'spoiler', text: '剧透' },
                    ' 与 ',
                    { type: 'underline', text: '下划线' },
                    ' 以及 ',
                    { type: 'code', text: 'const x = 1' },
                ],
            },
        ]);
        expect(markdown).toBe(
            '正常 **加粗带 *斜体*** 和 ||剧透|| 与 __下划线__ 以及 `const x = 1`'
        );
        expect(rendered.text).toBe('正常 加粗带 斜体 和 剧透 与 下划线 以及 const x = 1');
        expect(entityTypes(rendered)).toEqual(
            expect.arrayContaining(['bold', 'italic', 'spoiler', 'underline', 'code'])
        );
    });

    it('escapes markdown metacharacters in plain text', () => {
        const { rendered } = roundTrip([
            { type: 'paragraph', text: '价格 *不是* 加粗 __也不是__ 下划线 `code` [x](y) 1. 不是列表' },
        ]);
        expect(rendered.text).toBe('价格 *不是* 加粗 __也不是__ 下划线 `code` [x](y) 1. 不是列表');
        expect(rendered.entities).toEqual([]);
    });

    it('heading sizes map to # levels', () => {
        const { markdown } = roundTrip([
            { type: 'heading', size: 1, text: '大标题' },
            { type: 'heading', size: 3, text: '小标题' },
        ]);
        expect(markdown).toBe('# 大标题\n\n### 小标题');
    });

    it('pre block keeps raw content and language, extends fence', () => {
        const { markdown, rendered } = roundTrip([
            { type: 'pre', text: 'if (a > b) {\n    return "x";\n}\n```inner```', language: 'typescript' },
        ]);
        expect(markdown.startsWith('````typescript\n')).toBe(true);
        expect(rendered.text).toContain('if (a > b) {');
        expect(rendered.text).toContain('```inner```');
        expect(entityTypes(rendered)).toContain('pre');
    });

    it('lists: unordered, ordered with values, checkboxes, nesting', () => {
        const { markdown } = roundTrip([
            {
                type: 'list',
                items: [
                    { label: '•', blocks: [{ type: 'paragraph', text: '无序一' }] },
                    {
                        label: '•',
                        blocks: [
                            { type: 'paragraph', text: '无序二' },
                            {
                                type: 'list',
                                items: [
                                    { label: '1.', value: 1, type: '1', blocks: [{ type: 'paragraph', text: '嵌套有序' }] },
                                ],
                            },
                        ],
                    },
                    { label: '☑', has_checkbox: true, is_checked: true, blocks: [{ type: 'paragraph', text: '已完成' }] },
                ],
            },
        ]);
        expect(markdown).toContain('- 无序一');
        expect(markdown).toContain('1. 嵌套有序');
        expect(markdown).toContain('- [x] 已完成');
    });

    it('blockquote with credit and nested blocks', () => {
        const { markdown, rendered } = roundTrip([
            {
                type: 'blockquote',
                blocks: [
                    { type: 'paragraph', text: '引用第一段' },
                    { type: 'paragraph', text: '引用第二段' },
                ],
                credit: '某人',
            },
        ]);
        expect(markdown).toBe('> 引用第一段\n>\n> 引用第二段\n> — 某人');
        expect(entityTypes(rendered)).toContain('blockquote');
    });

    it('table renders as GFM pipes with alignment and caption', () => {
        const { markdown, rendered } = roundTrip([
            {
                type: 'table',
                caption: '成绩表',
                cells: [
                    [
                        { text: '名字', is_header: true, align: 'left', valign: 'top' },
                        { text: '分数', is_header: true, align: 'right', valign: 'top' },
                    ],
                    [
                        { text: '澪', align: 'left', valign: 'top' },
                        { text: '100', align: 'right', valign: 'top' },
                    ],
                ],
            },
        ]);
        expect(markdown).toContain('| 名字 | 分数 |');
        expect(markdown).toContain('| --- | ---: |');
        expect(markdown).toContain('**成绩表**');
        expect(rendered.text).toContain('澪');
    });

    it('details block round-trips through the dialect parser', () => {
        const { rendered } = roundTrip([
            {
                type: 'details',
                summary: '点击展开',
                blocks: [{ type: 'paragraph', text: '隐藏内容' }],
            },
        ]);
        expect(entityTypes(rendered)).toContain('expandable_blockquote');
        expect(rendered.text).toContain('点击展开');
        expect(rendered.text).toContain('隐藏内容');
    });

    it('media blocks degrade to placeholders with captions', () => {
        const { markdown } = roundTrip([
            { type: 'photo', caption: { text: '合照' } },
            { type: 'video' },
            { type: 'divider' },
            { type: 'mathematical_expression', expression: 'E = mc^2' },
        ]);
        expect(markdown).toContain('[图片] 合照');
        expect(markdown).toContain('[视频]');
        expect(markdown).toContain('---');
        expect(markdown).toContain('```latex\nE = mc^2\n```');
    });

    it('custom media placeholder option', () => {
        const markdown = richBlocksToMarkdown(
            [{ type: 'photo', caption: { text: 'p1' } }],
            { mediaPlaceholder: (kind, caption) => `<media:${kind}:${caption}>` }
        );
        expect(markdown).toContain('media:photo:p1');
    });

    it('duplicate nested styles are not double-wrapped', () => {
        const { markdown } = roundTrip([
            {
                type: 'paragraph',
                text: { type: 'bold', text: ['外层 ', { type: 'bold', text: '内层' }] },
            },
        ]);
        expect(markdown).toBe('**外层 内层**');
    });

    it('url and text_mention become links; passthrough entities stay text', () => {
        const { markdown, rendered } = roundTrip([
            {
                type: 'paragraph',
                text: [
                    { type: 'url', text: '链接', url: 'https://example.com/a(b) c' },
                    ' ',
                    { type: 'text_mention', text: '梓喵', user: { id: 12345 } },
                    ' ',
                    { type: 'hashtag', text: '#轻音部' },
                    ' ',
                    { type: 'custom_emoji', custom_emoji_id: '9', alternative_text: '🍰' },
                ],
            },
        ]);
        expect(markdown).toContain('[链接](https://example.com/a%28b%29%20c)');
        expect(markdown).toContain('[梓喵](tg://user?id=12345)');
        expect(rendered.text).toContain('#轻音部');
        expect(rendered.text).toContain('🍰');
        expect(entityTypes(rendered)).toContain('text_link');
    });

    it('style markers keep edge whitespace outside (flanking safety)', () => {
        const { markdown, rendered } = roundTrip([
            { type: 'paragraph', text: [{ type: 'bold', text: ' 前后有空格 ' }, '尾巴'] },
        ]);
        expect(markdown).toBe(' **前后有空格** 尾巴');
        expect(entityTypes(rendered)).toContain('bold');
    });
});

describe('richBlocksToMarkdown: Bot API 10.3 blocks', () => {
    it('expandable_blockquote becomes <details> without a summary, credit last', () => {
        const { markdown, rendered } = roundTrip([
            {
                type: 'expandable_blockquote',
                text: ['第一行\n第二行 ', { type: 'bold', text: '粗' }],
                credit: '某人',
            },
        ]);
        expect(markdown).toBe('<details>\n第一行\n第二行 **粗**\n— 某人\n</details>');
        expect(rendered.text).toBe('第一行\n第二行 粗\n— 某人');
        expect(entityTypes(rendered)).toEqual(expect.arrayContaining(['expandable_blockquote', 'bold']));
    });

    it('expandable_blockquote with a blank line inside, then a paragraph', () => {
        const { markdown, rendered } = roundTrip([
            { type: 'expandable_blockquote', text: 'a\n\nb' },
            { type: 'paragraph', text: 'after' },
        ]);
        expect(markdown).toBe('<details>\na\n\nb\n</details>\n\nafter');
        const quote = rendered.entities.find((entity) => entity.type === 'expandable_blockquote');
        expect(quote && rendered.text.slice(quote.offset, quote.offset + quote.length)).toBe('a\n\nb');
        expect(rendered.text.endsWith('after')).toBe(true);
    });

    it('expandable_blockquote inside a list item and inside a blockquote', () => {
        const { markdown, rendered } = roundTrip([
            { type: 'list', items: [{ label: '•', blocks: [{ type: 'expandable_blockquote', text: '藏' }] }] },
            { type: 'blockquote', blocks: [{ type: 'expandable_blockquote', text: '套' }] },
        ]);
        expect(markdown).toBe('- <details>\n  藏\n  </details>\n\n> <details>\n> 套\n> </details>');
        expect(rendered.text).toContain('藏');
        expect(rendered.text).toContain('套');
    });

    it('expandable_blockquote text that looks like markup stays literal', () => {
        const { rendered } = roundTrip([
            { type: 'expandable_blockquote', text: '</details> *x* # y' },
        ]);
        expect(rendered.text).toBe('</details> *x* # y');
        expect(entityTypes(rendered)).toEqual(['expandable_blockquote']);
    });

    it('an empty expandable_blockquote renders nothing', () => {
        expect(richBlocksToMarkdown([{ type: 'expandable_blockquote', text: '' }])).toBe('');
    });

    it('document: label, escaped file name, caption; no name gives the label alone', () => {
        const { markdown, rendered } = roundTrip([
            { type: 'document', document: { file_name: 'report_[v2].pdf' }, caption: { text: '周报' } },
            { type: 'document', document: {} },
        ]);
        expect(markdown).toBe('[文件] report\\_\\[v2\\].pdf 周报\n\n[文件]');
        expect(rendered.text).toBe('[文件] report_[v2].pdf 周报\n\n[文件]');
    });

    it('buttons row: url buttons keep the link, others their label (custom emoji alt)', () => {
        const { markdown, rendered } = roundTrip([
            {
                type: 'buttons',
                buttons: [
                    { text: '打开', url: 'https://t.me' },
                    { text: ['签到 ', { type: 'custom_emoji', custom_emoji_id: '5', alternative_text: '👍' }] },
                ],
            },
        ]);
        expect(markdown).toBe('[按钮] [打开](https://t.me) · 签到 👍');
        expect(rendered.text).toBe('[按钮] 打开 · 签到 👍');
        expect(entityTypes(rendered)).toEqual(['text_link']);
    });

    it('a buttons row without labels renders nothing', () => {
        expect(richBlocksToMarkdown([{ type: 'buttons', buttons: [{ text: '' }] }])).toBe('');
    });

    it('inline url and callback buttons', () => {
        const { markdown } = roundTrip([
            {
                type: 'paragraph',
                text: [
                    { type: 'button', button: { text: '这里', url: 'https://example.com' } },
                    ' ',
                    { type: 'button', button: { text: '回调' } },
                ],
            },
        ]);
        expect(markdown).toBe('[这里](https://example.com) 回调');
    });

    it('richTextToPlain flattens an inline button to its label', () => {
        expect(richTextToPlain(['a ', { type: 'button', button: { text: ['b', { type: 'bold', text: 'c' }] } }])).toBe('a bc');
    });

    it('ton_address passes its text through', () => {
        const { markdown } = roundTrip([
            { type: 'paragraph', text: ['钱包 ', { type: 'ton_address', text: 'EQx_1' }] },
        ]);
        expect(markdown).toBe('钱包 EQx\\_1');
    });

    it('custom mediaPlaceholder receives the document file name', () => {
        const calls: unknown[] = [];
        const markdown = richBlocksToMarkdown(
            [
                { type: 'document', document: { file_name: 'a.zip' }, caption: { text: 'c' } },
                { type: 'photo' },
            ],
            {
                mediaPlaceholder: (kind, caption, details) => {
                    calls.push([kind, caption, details]);
                    return `<${kind}>`;
                },
            }
        );
        expect(calls).toEqual([
            ['document', 'c', { fileName: 'a.zip' }],
            ['photo', '', {}],
        ]);
        expect(markdown).toBe('<document>\n\n<photo>');
    });

    it('slideshow renders its blocks and caption like a collage', () => {
        const { markdown } = roundTrip([
            {
                type: 'slideshow',
                blocks: [{ type: 'photo' }, { type: 'paragraph', text: '幻灯' }],
                caption: { text: '说明' },
            },
        ]);
        expect(markdown).toBe('[图片]\n\n幻灯\n说明');
    });
});

describe('richBlocksToMarkdown: input from a newer Bot API never throws', () => {
    it('unknown blocks keep their text and inner blocks; non-objects are skipped', () => {
        const blocks = JSON.parse(
            JSON.stringify([
                { type: 'future_block', text: '未来文本' },
                { type: 'future_container', blocks: [{ type: 'paragraph', text: '内层' }] },
                { type: 'future_empty' },
                { type: 'paragraph', text: ['a', { type: 'future_inline', payload: 1 }, { type: 'ton_address', text: 'EQx', address: 'EQx' }] },
                null,
                42,
                'text',
                [{ type: 'paragraph', text: 'nested array' }],
                { no_type: true, text: '无类型' },
            ])
        );
        expect(richBlocksToMarkdown(blocks)).toBe('未来文本\n\n内层\n\naEQx\n\n无类型');
    });

    it('an inline node without text renders nothing instead of throwing', () => {
        const blocks = JSON.parse(
            '[{"type":"paragraph","text":["x",{"type":"future_inline"},{"type":"button"},{"type":"button","button":5},{"type":"url","text":"u"},{"type":"text_mention","text":"m"}]}]'
        );
        expect(richBlocksToMarkdown(blocks)).toBe('xum');
        expect(richTextToPlain(JSON.parse('[{"type":"button"},{"type":"custom_emoji"},null,7]'))).toBe('');
    });

    it('a malformed known block degrades to its text', () => {
        const blocks = JSON.parse(
            '[{"type":"list","text":"列表文本"},{"type":"table","cells":5},{"type":"heading","size":99,"text":"标题"},{"type":"map","caption":{"text":"c"}},{"type":"document"}]'
        );
        expect(richBlocksToMarkdown(blocks)).toBe('列表文本\n\n# 标题\n\n[文件]');
    });

    it('a non-array blocks value gives an empty string', () => {
        expect(richBlocksToMarkdown(JSON.parse('null'))).toBe('');
        expect(richBlocksToMarkdown(JSON.parse('{"type":"paragraph","text":"x"}'))).toBe('');
    });
});
