/**
 * Core public types.
 *
 * MessageEntity is structurally compatible with @grammyjs/types / typegram /
 * telegraf entity objects, so consumers can pass results straight to any Bot
 * API framework without casting.
 */

export type EntityType =
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'spoiler'
    | 'code'
    | 'pre'
    | 'text_link'
    | 'blockquote'
    | 'expandable_blockquote';

export interface MessageEntity {
    type: EntityType;
    /** UTF-16 code units, as the Bot API requires */
    offset: number;
    /** UTF-16 code units, as the Bot API requires */
    length: number;
    /** text_link only */
    url?: string;
    /** pre only */
    language?: string;
}

export interface RenderedMessage {
    text: string;
    entities: MessageEntity[];
}

export interface RenderOptions {
    /**
     * Streaming mode: the input is a growing prefix of a document, so
     * unclosed constructs (bold, fences, links...) are rendered as their
     * intended formatting instead of literal marker characters.
     * On a complete document the output is identical to strict mode.
     */
    streaming?: boolean;
    /**
     * How to render GFM tables (default 'auto'):
     * - 'auto': narrow-only tables → monospace-aligned pre grid; tables
     *   containing East Asian Wide chars → nested bullet list (cross-client
     *   grid alignment is impossible for those: CJK glyphs, U+3000 and
     *   fullwidth punctuation resolve to different fallback fonts with
     *   different widths)
     * - 'pre': always the aligned pre grid
     * - 'records': always the nested bullet list (• **first cell** with
     *   one '    • header: value' sub-item per remaining cell)
     * - 'plain': rows joined with ' | ', no alignment, no pre
     */
    table?: 'auto' | 'pre' | 'records' | 'plain';
    /** Heading rendering (default 'bold'; 'bold-underline' underlines h1/h2) */
    heading?: 'bold' | 'bold-underline';
    /**
     * Render '__text__' as underline instead of CommonMark bold (default
     * true). Markdown has no standard underline syntax; this follows the
     * Telegram MarkdownV2 dialect, where '__' means underline and bold is
     * always written '**'. '_italic_' is unaffected.
     */
    underline?: boolean;
    /** String used in place of horizontal rules (default: a 10-em-dash line) */
    hrText?: string;
    /** Enable the ||spoiler|| dialect (default true) */
    spoiler?: boolean;
    /**
     * Emit text_link entities for bare URLs (default false — Telegram
     * clients auto-link plain URLs anyway)
     */
    linkifyBareUrls?: boolean;
}

export interface SplitOptions {
    /** Max UTF-16 length per chunk (default 4096, Telegram's message limit) */
    maxLength?: number;
    /** Max entities per chunk (default 90, under Telegram's ~100 silent cap) */
    maxEntities?: number;
}

export type ValidationIssueCode =
    | 'offset-out-of-bounds'
    | 'length-out-of-bounds'
    | 'surrogate-misaligned'
    | 'zero-length'
    | 'overlap-not-nested'
    | 'illegal-nesting'
    | 'text-too-long'
    | 'too-many-entities'
    | 'missing-url'
    | 'unexpected-field';

export interface ValidationIssue {
    code: ValidationIssueCode;
    message: string;
    /** Index into the entities array this issue refers to, if applicable */
    entityIndex?: number;
}

export interface PreviewOptions {
    /** Inline the default Telegram-like CSS into the output (default true) */
    includeStyles?: boolean;
}
