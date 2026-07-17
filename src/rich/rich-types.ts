/**
 * Structural types for Bot API 10.1+ rich messages (Message.rich_message).
 * Defined locally so the package stays dependency-free; they are shape-
 * compatible with grammy/@grammyjs/types RichBlock/RichText — callers pass
 * those straight in.
 */

export interface RichTextStyled {
    type:
        | 'bold'
        | 'italic'
        | 'underline'
        | 'strikethrough'
        | 'spoiler'
        | 'code'
        | 'marked'
        | 'subscript'
        | 'superscript';
    text: RichTextNode;
}

export interface RichTextUrl {
    type: 'url';
    text: RichTextNode;
    url: string;
}

export interface RichTextTextMention {
    type: 'text_mention';
    text: RichTextNode;
    user: { id: number };
}

export interface RichTextCustomEmoji {
    type: 'custom_emoji';
    custom_emoji_id: string;
    alternative_text: string;
}

export interface RichTextMathematicalExpression {
    type: 'mathematical_expression';
    expression: string;
}

export interface RichTextAnchor {
    type: 'anchor';
    name: string;
}

/** Server-detected entities and link-like wrappers: text passes through */
export interface RichTextPassthrough {
    type:
        | 'mention'
        | 'hashtag'
        | 'cashtag'
        | 'bot_command'
        | 'email_address'
        | 'phone_number'
        | 'bank_card_number'
        | 'date_time'
        | 'anchor_link'
        | 'reference'
        | 'reference_link';
    text: RichTextNode;
}

export type RichTextNode =
    | string
    | RichTextNode[]
    | RichTextStyled
    | RichTextUrl
    | RichTextTextMention
    | RichTextCustomEmoji
    | RichTextMathematicalExpression
    | RichTextAnchor
    | RichTextPassthrough;

export interface RichBlockCaption {
    text: RichTextNode;
    credit?: RichTextNode;
}

export interface RichBlockListItem {
    label: string;
    blocks: RichBlockNode[];
    has_checkbox?: true;
    is_checked?: true;
    value?: number;
    type?: 'a' | 'A' | 'i' | 'I' | '1';
}

export interface RichBlockTableCell {
    text?: RichTextNode;
    is_header?: true;
    colspan?: number;
    rowspan?: number;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
}

export interface RichBlockParagraph {
    type: 'paragraph';
    text: RichTextNode;
}

export interface RichBlockHeading {
    type: 'heading';
    text: RichTextNode;
    size: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface RichBlockPreformatted {
    type: 'pre';
    text: RichTextNode;
    language?: string;
}

export interface RichBlockFooter {
    type: 'footer';
    text: RichTextNode;
}

export interface RichBlockDivider {
    type: 'divider';
}

export interface RichBlockMathematicalExpression {
    type: 'mathematical_expression';
    expression: string;
}

export interface RichBlockAnchor {
    type: 'anchor';
    name: string;
}

export interface RichBlockList {
    type: 'list';
    items: RichBlockListItem[];
}

export interface RichBlockBlockQuotation {
    type: 'blockquote';
    blocks: RichBlockNode[];
    credit?: RichTextNode;
}

export interface RichBlockPullQuotation {
    type: 'pullquote';
    text: RichTextNode;
    credit?: RichTextNode;
}

export interface RichBlockTable {
    type: 'table';
    cells: RichBlockTableCell[][];
    caption?: RichTextNode;
}

export interface RichBlockDetails {
    type: 'details';
    summary: RichTextNode;
    blocks: RichBlockNode[];
    is_open?: true;
}

export interface RichBlockCollage {
    type: 'collage' | 'slideshow';
    blocks: RichBlockNode[];
    caption?: RichBlockCaption;
}

export interface RichBlockMap {
    type: 'map';
    location: { latitude: number; longitude: number };
    caption?: RichBlockCaption;
}

export interface RichBlockMedia {
    type: 'photo' | 'video' | 'animation' | 'audio' | 'voice_note';
    caption?: RichBlockCaption;
}

export interface RichBlockThinking {
    type: 'thinking';
}

export type RichBlockNode =
    | RichBlockParagraph
    | RichBlockHeading
    | RichBlockPreformatted
    | RichBlockFooter
    | RichBlockDivider
    | RichBlockMathematicalExpression
    | RichBlockAnchor
    | RichBlockList
    | RichBlockBlockQuotation
    | RichBlockPullQuotation
    | RichBlockTable
    | RichBlockDetails
    | RichBlockCollage
    | RichBlockMap
    | RichBlockMedia
    | RichBlockThinking;

/** Media-ish block kinds a placeholder is emitted for */
export type RichMediaKind = RichBlockMedia['type'] | 'map';

export interface RichBlocksToMarkdownOptions {
    /**
     * Custom placeholder for embedded media blocks. Receives the block kind
     * and its (already plain-text) caption; returns the text to emit.
     * Default: `[图片] caption` style placeholders.
     */
    mediaPlaceholder?: (kind: RichMediaKind, caption: string) => string;
}
