/**
 * Record-line fallback for tables that contain East Asian Wide characters.
 *
 * Grid alignment for such tables is unachievable across Telegram clients:
 * inside a pre block the mono font, the CJK fallback font and fullwidth
 * punctuation can resolve to THREE different advance widths (measured live
 * on macOS and Android, 2026-07-14), so no padding character is guaranteed
 * to match an ideograph's width — and padded grids overflow phone bubbles
 * and wrap anyway. Each body row instead becomes one line that needs no
 * column alignment at all:
 *
 *   **first cell** — header2: cell2 · header3: cell3
 *
 * The first column's own header label is dropped (the bold cell acts as the
 * record title); every other cell keeps its header as an inline label.
 */
import { isWideChar } from './east-asian-width';

export interface TableRecordLine {
    /** First cell of the row, rendered bold as the record title ('' if empty) */
    key: string;
    /** Remaining non-empty cells as 'label: value' (label omitted if blank) */
    fields: string[];
}

export const tableHasWideContent = (rows: string[][]): boolean =>
    rows.some((row) => row.some((cell) => [...cell].some(isWideChar)));

export const tableToRecordLines = (rows: string[][]): TableRecordLine[] => {
    if (rows.length === 0) return [];
    const header = rows[0] ?? [];
    const body = rows.slice(1);
    // Header-only table: show the header itself as one unlabeled record
    const dataRows = body.length > 0 ? body : [header];
    const labels = body.length > 0 ? header : [];

    return dataRows.map((row) => {
        const key = (row[0] ?? '').trim();
        const fields: string[] = [];
        for (let column = 1; column < row.length; column++) {
            const value = (row[column] ?? '').trim();
            if (value === '') continue;
            const label = (labels[column] ?? '').trim();
            fields.push(label === '' ? value : `${label}: ${value}`);
        }
        return { key, fields };
    });
};
