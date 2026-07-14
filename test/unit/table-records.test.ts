import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/index';

const CJK_TABLE =
    '| 名称 | 数量 | 单价 |\n| :--- | ---: | :--: |\n| 苹果 | 3 | ¥5.5 |\n| 香蕉(进口) | 12 | ¥3 |\n| longer english cell | 1 | $10.00 |';

const ASCII_TABLE =
    '| name | qty | price |\n| --- | ---: | --- |\n| apple | 3 | $5.50 |\n| longer english cell | 12 | $3 |';

describe('table auto mode', () => {
    it('renders wide-containing tables as record lines (no pre)', () => {
        const { text, entities } = renderMarkdown(CJK_TABLE);
        expect(entities.some((entity) => entity.type === 'pre')).toBe(false);
        expect(text).toBe(
            [
                '苹果 — 数量: 3 · 单价: ¥5.5',
                '香蕉(进口) — 数量: 12 · 单价: ¥3',
                'longer english cell — 数量: 1 · 单价: $10.00',
            ].join('\n')
        );
        // Each row's first cell is bolded as the record title
        const boldTexts = entities
            .filter((entity) => entity.type === 'bold')
            .map((entity) => text.slice(entity.offset, entity.offset + entity.length));
        expect(boldTexts).toEqual(['苹果', '香蕉(进口)', 'longer english cell']);
    });

    it('keeps narrow-only tables as an aligned pre grid', () => {
        const { text, entities } = renderMarkdown(ASCII_TABLE);
        const pre = entities.find((entity) => entity.type === 'pre');
        expect(pre).toBeDefined();
        if (!pre) return;
        const pipeColumns = text
            .slice(pre.offset, pre.offset + pre.length)
            .split('\n')
            .map((line) => line.indexOf(' | '));
        expect(new Set(pipeColumns).size).toBe(1);
    });
});

describe('table records mode', () => {
    it('can be forced for narrow-only tables', () => {
        const { text } = renderMarkdown(ASCII_TABLE, { table: 'records' });
        expect(text).toBe(
            ['apple — qty: 3 · price: $5.50', 'longer english cell — qty: 12 · price: $3'].join(
                '\n'
            )
        );
    });

    it('skips empty cells and handles missing trailing cells', () => {
        const { text } = renderMarkdown(
            '| a | b | c |\n| --- | --- | --- |\n| 混合mixed | | x |\n| 空 |',
            { table: 'records' }
        );
        expect(text).toBe(['混合mixed — c: x', '空'].join('\n'));
    });

    it('renders a header-only table as one unlabeled record', () => {
        const { text } = renderMarkdown('| 甲 | 乙 | 丙 |\n| --- | --- | --- |', {
            table: 'records',
        });
        expect(text).toBe('甲 — 乙 · 丙');
    });
});
