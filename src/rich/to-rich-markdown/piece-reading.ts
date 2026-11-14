/**
 * How Telegram reads a piece of the source. The document is markdown, and
 * so is the body of a <details> element that starts on a line of its own
 * (and what follows </details> on the lines after it): a line there that
 * starts with '#' is a heading. A <summary>, and body text on the line of a
 * tag, are HTML text instead: '\$', '\#' and a '\' before a line end show
 * as written there, a line end is a space and <br> a line break (all
 * measured on Bot API 10.4).
 */
export type PieceReading = 'markdown' | 'html';

/**
 * The reading of a <details> body piece, from its raw text: HTML when it
 * starts on the line of the tag before it, markdown when that line has
 * nothing more on it
 */
export const bodyPieceReading = (raw: string): PieceReading => {
    const lineEnd = raw.indexOf('\n');
    const firstLine = lineEnd === -1 ? raw : raw.slice(0, lineEnd);
    return firstLine.trim() === '' ? 'markdown' : 'html';
};
