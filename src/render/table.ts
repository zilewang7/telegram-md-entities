/**
 * GFM table → monospace text for a `pre` entity, aligned RATIO-INDEPENDENTLY.
 *
 * Inside Telegram's pre blocks, ASCII uses the client's mono font while CJK
 * glyphs fall back to a system font whose advance is NOT 2× the mono space
 * (and differs per client/platform), so display-width space padding cannot
 * align mixed columns everywhere. Instead, every cell in a column is padded
 * to the same COUNT of fullwidth chars (U+3000 pads) and the same COUNT of
 * halfwidth chars (space pads): each cell then occupies wideMax×r +
 * narrowMax units for ANY width ratio r — separators align on every client.
 */
import type { AlignType, Table } from 'mdast';
import { isWideChar } from './east-asian-width';
import { visibleTextOfNodes } from './plain-text';

const IDEOGRAPHIC_SPACE = '　';
const FULLWIDTH_DASH = '－';

interface CellCounts {
    wide: number;
    narrow: number;
}

const countCell = (value: string): CellCounts => {
    let wide = 0;
    let narrow = 0;
    for (const char of value) {
        if (isWideChar(char)) wide += 1;
        else narrow += 1;
    }
    return { wide, narrow };
};

const padCell = (
    value: string,
    target: CellCounts,
    align: AlignType
): string => {
    const counts = countCell(value);
    const widePad = IDEOGRAPHIC_SPACE.repeat(Math.max(0, target.wide - counts.wide));
    const narrowPad = ' '.repeat(Math.max(0, target.narrow - counts.narrow));

    if (align === 'right') return widePad + narrowPad + value;
    if (align === 'center') {
        const wideHalf = Math.floor(widePad.length / 2);
        const narrowHalf = Math.floor(narrowPad.length / 2);
        return (
            widePad.slice(0, wideHalf) +
            narrowPad.slice(0, narrowHalf) +
            value +
            widePad.slice(wideHalf) +
            narrowPad.slice(narrowHalf)
        );
    }
    return value + narrowPad + widePad;
};

export const tableToCells = (node: Table): string[][] =>
    node.children.map((row) => row.children.map((cell) => visibleTextOfNodes(cell.children)));

export const alignedTableText = (node: Table): string => {
    const rows = tableToCells(node);
    if (rows.length === 0) return '';

    const columnCount = Math.max(...rows.map((row) => row.length));
    // Cells may hold line breaks (<br>): budgets and padding are per LINE,
    // and a row with a multi-line cell expands to several physical lines
    const targets: CellCounts[] = Array.from({ length: columnCount }, (_, i) => {
        const counts = rows.flatMap((row) => (row[i] ?? '').split('\n').map(countCell));
        return {
            wide: Math.max(...counts.map((c) => c.wide)),
            narrow: Math.max(...counts.map((c) => c.narrow)),
        };
    });

    const renderRow = (row: string[]): string => {
        const cellLines = targets.map((_, i) => (row[i] ?? '').split('\n'));
        const height = Math.max(1, ...cellLines.map((lines) => lines.length));
        return Array.from({ length: height }, (_, line) =>
            targets
                .map((target, i) =>
                    padCell(cellLines[i]?.[line] ?? '', target, node.align?.[i] ?? null)
                )
                .join(' | ')
                .trimEnd()
        ).join('\n');
    };

    // Separator row plays by the same counting rules: fullwidth dashes fill
    // the wide budget, ASCII dashes fill the narrow budget
    const separator = targets
        .map((target) => FULLWIDTH_DASH.repeat(target.wide) + '-'.repeat(target.narrow))
        .join(' | ')
        .trimEnd();

    const headerRow = rows[0] ?? [];
    const body = rows.slice(1).map(renderRow);

    return [renderRow(headerRow), separator, ...body].join('\n');
};

export const plainTableText = (node: Table): string =>
    tableToCells(node)
        // plain mode keeps one physical line per row
        .map((row) => row.map((cell) => cell.replace(/\n/g, ' ')).join(' | '))
        .join('\n');
