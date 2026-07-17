import { describe, expect, it } from 'vitest';
import { renderMarkdown, richBlocksToMarkdown, validateMessage } from '../../src/index';
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
