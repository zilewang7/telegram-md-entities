/** HTML escaping for rich-message HTML blocks */

const TEXT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const ATTRIBUTE_ESCAPES: Record<string, string> = { ...TEXT_ESCAPES, '"': '&quot;' };

export const escapeHtmlText = (text: string): string =>
    text.replace(/[&<>]/g, (char) => TEXT_ESCAPES[char] ?? char);

export const escapeHtmlAttribute = (value: string): string =>
    value.replace(/[&<>"]/g, (char) => ATTRIBUTE_ESCAPES[char] ?? char);
