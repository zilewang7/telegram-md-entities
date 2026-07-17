import { describe, expect, it } from 'vitest';
import { entitiesToMarkdown, renderMarkdown, styleSegments, validateMessage } from '../../src/index';
import type { EntityType, MessageEntity, ReadableMessage } from '../../src/index';

/**
 * Round-trip referee: reverse to markdown, re-render, compare per-character
 * style coverage. Whitespace-only segments may legally change style set
 * (markers close at non-whitespace edges), so styles on whitespace-only
 * segments are ignored on both sides.
 */
const expectRoundTrip = (message: ReadableMessage): string => {
    const markdown = entitiesToMarkdown(message);
    const rendered = renderMarkdown(markdown);
    expect(validateMessage(rendered)).toEqual([]);

    // Char-level re-normalization: whitespace chars drop their styles (markers
    // legally close at non-whitespace edges), then re-RLE so segmentation
    // granularity differences between the two sides don't matter.
    const relax = (segments: { text: string; styles: string[] }[]) => {
        const perChar: { char: string; key: string }[] = [];
        for (const segment of segments) {
            // code is opaque in this dialect (styles split around it), so
            // chars under code compare by code alone
            const styles = segment.styles.includes('code')
                ? ['code']
                : segment.styles;
            for (const char of segment.text) {
                perChar.push({
                    char,
                    key: /\s/.test(char) ? '' : styles.join('|'),
                });
            }
        }
        const merged: { text: string; styles: string }[] = [];
        for (const { char, key } of perChar) {
            const previous = merged[merged.length - 1];
            if (previous && previous.styles === key) previous.text += char;
            else merged.push({ text: char, styles: key });
        }
        return merged;
    };

    const KNOWN_TYPES = new Set<string>([
        'bold', 'italic', 'underline', 'strikethrough', 'spoiler',
        'code', 'pre', 'text_link', 'blockquote', 'expandable_blockquote',
    ]);
    const isKnownType = (value: string): value is EntityType => KNOWN_TYPES.has(value);

    const originalEntities: MessageEntity[] = [];
    for (const entity of message.entities ?? []) {
        if (isKnownType(entity.type)) {
            originalEntities.push({
                type: entity.type,
                offset: entity.offset,
                length: entity.length,
                ...(entity.url !== undefined ? { url: entity.url } : {}),
                ...(entity.language !== undefined ? { language: entity.language } : {}),
            });
        } else if (entity.type === 'text_mention' && entity.user) {
            // reverse emits text_mention as a tg://user link — compare as such
            originalEntities.push({
                type: 'text_link',
                offset: entity.offset,
                length: entity.length,
                url: `tg://user?id=${entity.user.id}`,
            });
        }
    }
    const original = { text: message.text, entities: originalEntities };

    expect(relax(styleSegments(rendered))).toEqual(relax(styleSegments(original)));
    return markdown;
};

describe('entitiesToMarkdown', () => {
    it('plain text with markdown metacharacters survives verbatim', () => {
        const markdown = entitiesToMarkdown({ text: '2 * 3 = 6, __init__, [a](b), #tag' });
        const rendered = renderMarkdown(markdown);
        expect(rendered.text).toBe('2 * 3 = 6, __init__, [a](b), #tag');
        expect(rendered.entities).toEqual([]);
    });

    it('simple styles round-trip', () => {
        expectRoundTrip({
            text: '加粗 斜体 下划线 删除 剧透 代码',
            entities: [
                { type: 'bold', offset: 0, length: 2 },
                { type: 'italic', offset: 3, length: 2 },
                { type: 'underline', offset: 6, length: 3 },
                { type: 'strikethrough', offset: 10, length: 2 },
                { type: 'spoiler', offset: 13, length: 2 },
                { type: 'code', offset: 16, length: 2 },
            ],
        });
    });

    it('nested styles (bold containing italic)', () => {
        const markdown = expectRoundTrip({
            text: '外层内部外层',
            entities: [
                { type: 'bold', offset: 0, length: 6 },
                { type: 'italic', offset: 2, length: 2 },
            ],
        });
        expect(markdown).toBe('**外层*内部*外层**');
    });

    it('overlapping (non-nested) entities close and reopen', () => {
        // bold [0,4), italic [2,6) — impossible as a tree, must split
        expectRoundTrip({
            text: 'aabbcc',
            entities: [
                { type: 'bold', offset: 0, length: 4 },
                { type: 'italic', offset: 2, length: 6 },
            ],
        });
    });

    it('server-split entities merge back (two bolds adjacent)', () => {
        const markdown = expectRoundTrip({
            text: '一二三四',
            entities: [
                { type: 'bold', offset: 0, length: 2 },
                { type: 'bold', offset: 2, length: 2 },
            ],
        });
        expect(markdown).toBe('**一二三四**');
    });

    it('text_link and text_mention become links; auto-detections pass through', () => {
        const markdown = expectRoundTrip({
            text: '看 文档 和 梓喵 及 https://example.com #tag @user',
            entities: [
                { type: 'text_link', offset: 2, length: 2, url: 'https://example.com/docs' },
                { type: 'text_mention', offset: 7, length: 2, user: { id: 42 } },
                { type: 'url', offset: 12, length: 19 },
                { type: 'hashtag', offset: 32, length: 4 },
                { type: 'mention', offset: 37, length: 5 },
            ],
        });
        expect(markdown).toContain('[文档](https://example.com/docs)');
        expect(markdown).toContain('[梓喵](tg://user?id=42)');
        expect(markdown).toContain('https://example.com');
    });

    it('whitespace-padded entity edges trim to visible characters', () => {
        const markdown = expectRoundTrip({
            text: 'a  b  c',
            entities: [{ type: 'bold', offset: 1, length: 5 }],
        });
        expect(markdown).toBe('a  **b**  c');
    });

    it('pre block with language', () => {
        const message: ReadableMessage = {
            text: '看这段:\nconst x = 1;\nreturn x;\n完事',
            entities: [{ type: 'pre', offset: 5, length: 23, language: 'typescript' }],
        };
        const markdown = entitiesToMarkdown(message);
        const rendered = renderMarkdown(markdown);
        expect(validateMessage(rendered)).toEqual([]);
        expect(markdown).toContain('```typescript');
        expect(rendered.text).toContain('const x = 1;');
        expect(rendered.entities.some((entity) => entity.type === 'pre')).toBe(true);
    });

    it('blockquote with inline styles inside, following text stays outside', () => {
        const message: ReadableMessage = {
            text: '他说:\n名言警句\n我不信',
            entities: [
                { type: 'blockquote', offset: 4, length: 4 },
                { type: 'bold', offset: 4, length: 2 },
            ],
        };
        const markdown = entitiesToMarkdown(message);
        const rendered = renderMarkdown(markdown);
        expect(validateMessage(rendered)).toEqual([]);
        const quote = rendered.entities.find((entity) => entity.type === 'blockquote');
        expect(quote).toBeDefined();
        expect(rendered.text.slice(quote?.offset, (quote?.offset ?? 0) + (quote?.length ?? 0))).toBe('名言警句');
        expect(rendered.text).toContain('我不信');
        expect(rendered.entities.some((entity) => entity.type === 'bold')).toBe(true);
    });

    it('expandable blockquote maps to details', () => {
        const message: ReadableMessage = {
            text: '剧透注意\n下面全是剧透内容',
            entities: [{ type: 'expandable_blockquote', offset: 5, length: 7 }],
        };
        const markdown = entitiesToMarkdown(message);
        const rendered = renderMarkdown(markdown);
        expect(markdown).toContain('<details>');
        expect(rendered.entities.some((entity) => entity.type === 'expandable_blockquote')).toBe(true);
    });

    it('code inside bold stays intact', () => {
        expectRoundTrip({
            text: '重点 npm install 收尾',
            entities: [
                { type: 'bold', offset: 0, length: 14 },
                { type: 'code', offset: 3, length: 11 },
            ],
        });
    });

    it('inline code containing backticks extends its fence', () => {
        const message: ReadableMessage = {
            text: 'wrap `x` here',
            entities: [{ type: 'code', offset: 0, length: 13 }],
        };
        const markdown = entitiesToMarkdown(message);
        const rendered = renderMarkdown(markdown);
        expect(rendered.text).toBe('wrap `x` here');
        expect(rendered.entities.some((entity) => entity.type === 'code')).toBe(true);
    });

    it('multi-paragraph styled text closes and reopens across the break', () => {
        expectRoundTrip({
            text: '第一段\n\n第二段',
            entities: [{ type: 'bold', offset: 0, length: 8 }],
        });
    });

    it('CJK punctuation adjacent styles survive (cjk-friendly)', () => {
        expectRoundTrip({
            text: '的"重点"后续',
            entities: [{ type: 'bold', offset: 1, length: 4 }],
        });
    });
});
