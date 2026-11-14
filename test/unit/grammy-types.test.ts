/**
 * Type compatibility with grammy's Bot API 10.3 types (@grammyjs/types
 * 5.0.0, a devDependency for this file only). The compile step is the real
 * test: `pnpm typecheck` fails as soon as a grammy RichBlock / RichText
 * member is not assignable to the package's structural types.
 */
import type { Message, RichBlock, RichText } from '@grammyjs/types';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, richBlocksToMarkdown, richTextToMarkdown, richTextToPlain } from '../../src/index';

// Whole-union assignability, not just the literals below
const blocksToMarkdown = (blocks: RichBlock[]): string => richBlocksToMarkdown(blocks);
const textToMarkdown = (text: RichText): string => richTextToMarkdown(text);
const textToPlain = (text: RichText): string => richTextToPlain(text);
const messageToMarkdown = (message: Message.RichMessageMessage): string =>
    richBlocksToMarkdown(message.rich_message.blocks);

const BLOCKS_10_3: RichBlock[] = [
    {
        type: 'expandable_blockquote',
        text: ['第一行\n第二行 ', { type: 'bold', text: '粗' }],
        credit: '某人',
    },
    {
        type: 'document',
        document: {
            file_id: 'FILE',
            file_unique_id: 'UNIQUE',
            file_name: 'report.pdf',
            mime_type: 'application/pdf',
            file_size: 2048,
        },
        caption: { text: '周报' },
    },
    {
        type: 'buttons',
        buttons: [
            { text: '打开', url: 'https://example.com/a' },
            { text: '签到', callback_data: 'check-in' },
        ],
    },
    {
        type: 'paragraph',
        text: [
            '点 ',
            { type: 'button', button: { text: '这里', url: 'https://example.com/b' } },
            ' 或 ',
            { type: 'button', button: { text: '回调', callback_data: 'x' } },
        ],
    },
];

describe('grammy @grammyjs/types 5.0.0 (Bot API 10.3) input', () => {
    it('RichBlock[] with every 10.3 block renders', () => {
        const markdown = blocksToMarkdown(BLOCKS_10_3);
        expect(markdown).toBe(
            [
                '<details>\n第一行\n第二行 **粗**\n— 某人\n</details>',
                '[文件] report.pdf 周报',
                '[按钮] [打开](https://example.com/a) · 签到',
                '点 [这里](https://example.com/b) 或 回调',
            ].join('\n\n')
        );
        const rendered = renderMarkdown(markdown);
        expect(rendered.entities.map((entity) => entity.type)).toContain('expandable_blockquote');
    });

    it('RichText with an inline button renders and flattens', () => {
        const text: RichText = ['看 ', { type: 'button', button: { text: '链接', url: 'https://t.me' } }];
        expect(textToMarkdown(text)).toBe('看 [链接](https://t.me)');
        expect(textToPlain(text)).toBe('看 链接');
    });

    it('a rich message from an update renders its blocks', () => {
        const message: Message.RichMessageMessage = {
            message_id: 1,
            date: 0,
            chat: { id: 1, type: 'private', first_name: 'a' },
            rich_message: { blocks: [{ type: 'paragraph', text: 'hi' }] },
        };
        expect(messageToMarkdown(message)).toBe('hi');
    });
});
