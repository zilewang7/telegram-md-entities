/**
 * GFM table → monospace-aligned text for a `pre` entity. Column widths are
 * computed in display columns (East Asian Wide = 2) so CJK tables align on
 * Telegram's monospace font.
 */
import type { AlignType, Table } from 'mdast';
import { displayWidth } from './east-asian-width';
import { plainTextOfNodes } from './plain-text';

const padCell = (value: string, width: number, align: AlignType): string => {
    const padding = Math.max(0, width - displayWidth(value));
    if (align === 'right') return ' '.repeat(padding) + value;
    if (align === 'center') {
        const left = Math.floor(padding / 2);
        return ' '.repeat(left) + value + ' '.repeat(padding - left);
    }
    return value + ' '.repeat(padding);
};

export const tableToCells = (node: Table): string[][] =>
    node.children.map((row) => row.children.map((cell) => plainTextOfNodes(cell.children)));

export const alignedTableText = (node: Table): string => {
    const rows = tableToCells(node);
    if (rows.length === 0) return '';

    const columnCount = Math.max(...rows.map((row) => row.length));
    const aligns: AlignType[] = Array.from(
        { length: columnCount },
        (_, i) => node.align?.[i] ?? null
    );
    const widths = Array.from({ length: columnCount }, (_, i) =>
        Math.max(...rows.map((row) => displayWidth(row[i] ?? '')))
    );

    const renderRow = (row: string[]): string =>
        widths
            .map((width, i) => padCell(row[i] ?? '', width, aligns[i] ?? null))
            .join(' | ')
            .trimEnd();

    const headerRow = rows[0] ?? [];
    const separator = widths.map((width) => '-'.repeat(Math.max(1, width))).join(' | ');
    const body = rows.slice(1).map(renderRow);

    return [renderRow(headerRow), separator, ...body].join('\n');
};

export const plainTableText = (node: Table): string =>
    tableToCells(node)
        .map((row) => row.join(' | '))
        .join('\n');
