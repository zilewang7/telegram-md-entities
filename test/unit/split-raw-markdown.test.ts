import { describe, expect, it } from 'vitest';
import {
    renderMarkdown,
    splitRawMarkdown,
    splitRawMarkdownAtNewline,
} from '../../src/index';
import { loadCorpus } from '../helpers/corpus';

/** fits predicate measuring the actual rendered length, like the bot does */
const fitsChars = (budget: number) => (prefix: string): boolean =>
    renderMarkdown(prefix, { streaming: true }).text.length <= budget;

describe('splitRawMarkdown', () => {
    it('returns everything as head when it fits', () => {
        const { head, rest } = splitRawMarkdown('短文本', fitsChars(100));
        expect(head).toBe('短文本');
        expect(rest).toBe('');
    });

    it('cuts at a clean paragraph boundary', () => {
        const raw = `${'甲'.repeat(60)}\n\n${'乙'.repeat(60)}\n\n${'丙'.repeat(60)}`;
        const { head, rest } = splitRawMarkdown(raw, fitsChars(140));
        expect(head).toBe(`${'甲'.repeat(60)}\n\n${'乙'.repeat(60)}\n\n`);
        expect(rest).toBe('丙'.repeat(60));
    });

    it('avoids paragraph boundaries inside a <details> element', () => {
        const raw = [
            '前置段落。'.repeat(10),
            '',
            '<details>',
            '<summary>标题</summary>',
            '',
            '内容甲。'.repeat(10),
            '',
            '内容乙。'.repeat(10),
            '',
            '</details>',
            '',
            '尾部段落。'.repeat(30),
        ].join('\n');
        // Budget lands the hard cut inside the details body; the clean cut
        // pulls back to the boundary before <details>
        const { head, rest } = splitRawMarkdown(raw, fitsChars(120));
        expect(head).toBe('前置段落。'.repeat(10) + '\n\n');
        expect(rest.startsWith('<details>')).toBe(true);
    });

    it('avoids newline boundaries inside a fenced code block', () => {
        const raw = ['开头段落。', '', '```js', 'line1();', 'line2();', 'line3();', '```', '', '结尾。'].join('\n');
        const { head, rest } = splitRawMarkdown(raw, fitsChars(30));
        expect(head).toBe('开头段落。\n\n');
        expect(rest.startsWith('```js')).toBe(true);
    });

    it('avoids cutting between table rows', () => {
        const rows = Array.from({ length: 6 }, (_, i) => `| r${i} | v${i} |`);
        const raw = ['文字。', '', '| a | b |', '| --- | --- |', ...rows].join('\n');
        const { head, rest } = splitRawMarkdown(raw, fitsChars(40));
        expect(head).toBe('文字。\n\n');
        expect(rest.startsWith('| a | b |')).toBe(true);
    });

    it('reopens a fence when a giant code block must be cut', () => {
        const codeLines = Array.from({ length: 40 }, (_, i) => `console.log(${i});`);
        const raw = '```js\n' + codeLines.join('\n') + '\n```';
        const { head, rest } = splitRawMarkdown(raw, fitsChars(300));
        expect(head.startsWith('```js')).toBe(true);
        expect(rest.startsWith('```js\n')).toBe(true);

        // Both halves render as pre; the rest's closing fence must not
        // swallow following text (the original failure mode)
        const headRendered = renderMarkdown(head, { streaming: true });
        expect(headRendered.entities.some((e) => e.type === 'pre')).toBe(true);
        const restRendered = renderMarkdown(rest + '\n\n后续正常段落');
        const pre = restRendered.entities.find((e) => e.type === 'pre');
        expect(pre).toBeDefined();
        expect(restRendered.text).toContain('后续正常段落');
        const preText = restRendered.text.slice(pre!.offset, pre!.offset + pre!.length);
        expect(preText).not.toContain('后续正常段落');
    });

    it('reopens <details> with the original summary when its body must be cut', () => {
        const body = Array.from({ length: 20 }, (_, i) => `第 ${i} 段内容，足够长的一行说明文字。`).join('\n\n');
        const raw = `<details>\n<summary>听后感<b>解析</b></summary>\n\n${body}\n</details>`;
        const { head, rest } = splitRawMarkdown(raw, fitsChars(200));
        expect(rest.startsWith('<details>\n<summary>听后感<b>解析</b>（续）</summary>')).toBe(true);

        const headRendered = renderMarkdown(head, { streaming: true });
        expect(headRendered.entities.some((e) => e.type === 'expandable_blockquote')).toBe(true);
        const restRendered = renderMarkdown(rest);
        expect(restRendered.entities.some((e) => e.type === 'expandable_blockquote')).toBe(true);
        expect(restRendered.text).not.toContain('</details>');
        expect(restRendered.text).toContain('（续）');
    });

    it('repeats the table header when a giant table must be cut', () => {
        const rows = Array.from({ length: 30 }, (_, i) => `| 行${i} | 值${i} |`);
        const raw = ['| 名称 | 说明 |', '| --- | --- |', ...rows].join('\n');
        const { head, rest } = splitRawMarkdown(raw, fitsChars(150));
        expect(rest.startsWith('| 名称 | 说明 |\n| --- | --- |\n| 行')).toBe(true);
        // The rest renders as a real table again (record lines for CJK)
        const restRendered = renderMarkdown(rest);
        expect(restRendered.text).toContain('• 行');
        const headRendered = renderMarkdown(head, { streaming: true });
        expect(headRendered.text).toContain('• 行0');
    });

    it('reopens inline markers when one enormous paragraph must be cut', () => {
        const raw = `一句话。**加粗的超长内容${'呀'.repeat(120)}继续加粗**结束。`;
        const { head, rest } = splitRawMarkdown(raw, fitsChars(80));
        expect(rest.startsWith('**')).toBe(true);
        const restRendered = renderMarkdown(rest);
        expect(restRendered.entities.some((e) => e.type === 'bold')).toBe(true);
        expect(restRendered.text).not.toContain('**');
    });

    it('reopens inline html tags when a tagged paragraph must be cut', () => {
        const raw = `<b>很长的加粗句子。${'字'.repeat(120)}还没有闭合。</b>`;
        const { head, rest } = splitRawMarkdown(raw, fitsChars(80));
        expect(rest.startsWith('<b>')).toBe(true);
        const restRendered = renderMarkdown(rest);
        expect(restRendered.entities.some((e) => e.type === 'bold')).toBe(true);
    });

    it('never throws and never loses raw content across the corpus', () => {
        for (const { markdown } of loadCorpus()) {
            for (const budget of [80, 200, 600]) {
                const { head, rest } = splitRawMarkdown(markdown, fitsChars(budget));
                expect(() => renderMarkdown(head, { streaming: true })).not.toThrow();
                expect(() => renderMarkdown(rest, { streaming: true })).not.toThrow();
                if (rest === '') {
                    expect(head).toBe(markdown);
                    continue;
                }
                // head + rest cover the raw string (rest may add a reopen prefix)
                expect(head).toBe(markdown.slice(0, head.length));
                expect(rest.endsWith(markdown.slice(head.length))).toBe(true);
            }
        }
    });
});

describe('splitRawMarkdownAtNewline', () => {
    it('cuts at the last paragraph break', () => {
        const { head, rest } = splitRawMarkdownAtNewline('第一段\n\n第二段\n\n第三段');
        expect(head).toBe('第一段\n\n第二段');
        expect(rest).toBe('第三段');
    });

    it('skips a paragraph break inside a fence and picks an earlier clean one', () => {
        const raw = '第一段\n\n```\ncode\n\nmore\ncode';
        const { head, rest } = splitRawMarkdownAtNewline(raw);
        expect(head).toBe('第一段');
        expect(rest.startsWith('```')).toBe(true);
    });

    it('returns an empty head when no clean boundary qualifies', () => {
        const { head, rest } = splitRawMarkdownAtNewline('```\ncode\ncode');
        expect(head).toBe('');
        expect(rest).toBe('```\ncode\ncode');
    });

    it('respects minPos', () => {
        const raw = '早段\n\n后面一大串没有换行的内容';
        const { head } = splitRawMarkdownAtNewline(raw, raw.length - 3);
        expect(head).toBe('');
    });
});

describe('stray details/summary tags render silently', () => {
    it('drops stray closes and keeps content', () => {
        const { text } = renderMarkdown('剩余正文段落\n</details>\n\n后续');
        expect(text).not.toContain('</details>');
        expect(text).toContain('剩余正文段落');
        expect(text).toContain('后续');
    });

    it('drops a stray </summary> too', () => {
        const { text } = renderMarkdown('标题残段</summary>\n\n正文');
        expect(text).toBe('标题残段\n\n正文');
    });
});
