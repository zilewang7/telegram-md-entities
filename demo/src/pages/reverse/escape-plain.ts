/**
 * Plain text -> markdown that renders back to the same text.
 *
 * The reverse direction's HTML path escapes by construction
 * (entitiesToMarkdown rebuilds markers from entities); the plain-text path has
 * no entities to infer, so every markdown character in the text has to be
 * escaped instead of being read as formatting. On iOS, whose clipboard copy
 * writes no HTML, `**` in the copied message is a literal two asterisks.
 *
 * Rules mirror the library's reverse-direction escape (rich/escape-markdown.ts):
 * the acceptance rule is renderMarkdown(escaped) showing the original text.
 */

/** Inline characters that can open constructs anywhere in a line */
const INLINE_SPECIALS = /[\\`*_[\]~|<>&]/g;

const escapeLine = (line: string): string => {
  let escaped = line.replace(INLINE_SPECIALS, (char) => `\\${char}`);

  // Block starters only bite at the start of a line: ATX headings, list
  // bullets, hr / setext underlines. ('>' is already covered above.)
  escaped = escaped.replace(/^(\s*)([#+=-])/, '$1\\$2');
  // Ordered-list starters: "1. " / "1) "
  escaped = escaped.replace(/^(\s*)(\d+)([.)])(?=\s|$)/, '$1$2\\$3');
  // Four spaces of indentation would become an indented code block
  escaped = escaped.replace(/^ {4,}/, '   ');

  return escaped;
};

export const escapePlainMarkdown = (text: string): string =>
  text.split('\n').map(escapeLine).join('\n');
