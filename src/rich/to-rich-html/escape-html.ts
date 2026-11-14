/**
 * HTML escaping for rich-message HTML blocks. Telegram's rich HTML parser
 * treats whitespace like a browser (measured live): outside <pre> a run of
 * spaces collapses and a line's leading spaces vanish, and inside <pre> an
 * empty line ends the HTML block in the surrounding markdown document.
 */

const TEXT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const ATTRIBUTE_ESCAPES: Record<string, string> = { ...TEXT_ESCAPES, '"': '&quot;' };

const NO_BREAK_SPACE = '&nbsp;';
/** A newline written as a character reference: text to the HTML parser, no line to markdown */
const NEWLINE_REFERENCE = '&#10;';

export const escapeHtmlText = (text: string): string =>
    text.replace(/[&<>]/g, (char) => TEXT_ESCAPES[char] ?? char);

export const escapeHtmlAttribute = (value: string): string =>
    value.replace(/[&<>"]/g, (char) => ATTRIBUTE_ESCAPES[char] ?? char);

const isLineStart = (text: string, index: number): boolean => index === 0 || text[index - 1] === '\n';

/**
 * The HTML of every character of text that flows (a paragraph, a quote):
 * newlines become <br>; a space keeps its width as &nbsp; when it follows
 * another space or starts a line, where the parser would drop it.
 */
export const flowingTextHtml = (text: string): string[] =>
    Array.from(text, (_, index): string => {
        const char = text[index] ?? '';
        if (char === '\n') return '<br>';
        if (char === ' ' && (isLineStart(text, index) || text[index - 1] === ' ')) return NO_BREAK_SPACE;
        return TEXT_ESCAPES[char] ?? char;
    });

/**
 * <pre> content: newlines stay (the parser keeps them there), but no line
 * of the markdown source may be empty or blank, or the HTML block ends.
 * The newline that ends such a line is written as &#10;, joining it to the
 * next one. The first line follows the opening tag and is never empty.
 */
export const preTextHtml = (text: string): string => {
    const [first = '', ...rest] = escapeHtmlText(text).split('\n');
    let output = first;
    let currentLineIsBlank = false;
    for (const line of rest) {
        if (currentLineIsBlank) {
            output += NEWLINE_REFERENCE + line;
            currentLineIsBlank = false;
        } else {
            output += `\n${line}`;
            currentLineIsBlank = line.trim() === '';
        }
    }
    return output;
};
