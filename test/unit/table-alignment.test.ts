import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/index';
import { isWideChar } from '../../src/render/east-asian-width';

const counts = (value: string): { wide: number; narrow: number } => {
    let wide = 0;
    let narrow = 0;
    for (const char of value) {
        if (isWideChar(char)) wide += 1;
        else narrow += 1;
    }
    return { wide, narrow };
};

/**
 * Count-padding invariant for the FORCED grid mode ('pre'): per column,
 * every row carries the same count of wide chars and the same count of
 * narrow chars, so pipes align in any true-monospace context (terminal,
 * the preview renderer). Real Telegram clients resolve different wide
 * chars to different fallback fonts, which is why 'auto' routes
 * wide-containing tables to record lines instead. The last column is
 * exempt (rows are right-trimmed; nothing aligns after it).
 */
const expectRatioIndependentAlignment = (markdown: string): void => {
    const rendered = renderMarkdown(markdown, { table: 'pre' });
    const pre = rendered.entities.find((entity) => entity.type === 'pre');
    expect(pre).toBeDefined();
    if (!pre) return;

    const lines = rendered.text
        .slice(pre.offset, pre.offset + pre.length)
        .split('\n')
        .map((line) => line.split(' | '));

    const columnCount = Math.max(...lines.map((cells) => cells.length));
    for (let column = 0; column < columnCount - 1; column++) {
        // Rows are right-trimmed, so a column only participates in alignment
        // on rows that still have content after it
        const perRow = lines
            .filter((cells) => cells.length - 1 > column)
            .map((cells) => counts(cells[column] ?? ''));
        const first = perRow[0];
        for (const row of perRow) {
            expect(row).toEqual(first);
        }
    }
};

describe('table ratio-independent alignment', () => {
    it('mixed CJK/ASCII columns', () => {
        expectRatioIndependentAlignment(
            '| 名称 | 数量 | 单价 |\n| :--- | ---: | :--: |\n| 苹果 | 3 | ¥5.5 |\n| 香蕉(进口) | 12 | ¥3 |\n| longer english cell | 1 | $10.00 |'
        );
    });

    it('pure CJK and pure ASCII columns', () => {
        expectRatioIndependentAlignment(
            '| 中文列 | ascii |\n| --- | --- |\n| 内容甲 | abc |\n| 长一点的内容 | defghij |'
        );
    });

    it('empty cells and missing trailing cells', () => {
        expectRatioIndependentAlignment(
            '| a | b | c |\n| --- | --- | --- |\n| 混合mixed | | x |\n| y | 空 |'
        );
    });
});
