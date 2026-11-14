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

const isHighSurrogate = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff;
const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

/** The HTML of the UTF-16 unit at index; a surrogate pair goes out whole at its high unit */
const unitHtml = (text: string, index: number): string => {
    const unit = text.charCodeAt(index);
    if (isHighSurrogate(unit) && isLowSurrogate(text.charCodeAt(index + 1))) return text.slice(index, index + 2);
    if (isLowSurrogate(unit) && isHighSurrogate(text.charCodeAt(index - 1))) return '';
    const char = text[index] ?? '';
    if (char === '\n') return '<br>';
    if (char === ' ' && (isLineStart(text, index) || text[index - 1] === ' ')) return NO_BREAK_SPACE;
    return TEXT_ESCAPES[char] ?? char;
};

/**
 * The HTML of every UTF-16 unit of text that flows (a paragraph, a quote),
 * so callers can slice it with entity offsets: newlines become <br>; a
 * space keeps its width as &nbsp; when it follows another space or starts a
 * line, where the parser would drop it.
 */
export const flowingTextHtml = (text: string): string[] => {
    const html: string[] = [];
    for (let index = 0; index < text.length; index += 1) html.push(unitHtml(text, index));
    return html;
};

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
