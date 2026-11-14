/**
 * Structural types for Bot API 10.1–10.3 rich messages (Message.rich_message),
 * plus the 10.4 ton_address inline. Defined locally so the package stays
 * dependency-free; they are shape-compatible with grammy/@grammyjs/types
 * RichBlock/RichText — callers pass those straight in.
 *
 * The unions stay closed (a mistyped shape is a compile error), so every
 * new Bot API type is added here; at runtime the renderers are lenient and
 * degrade unknown types to their text instead of throwing.
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
        | 'reference_link'
        | 'ton_address';
    text: RichTextNode;
}

/**
 * Bot API 10.3 RichMessageButton. Every button kind (url, callback_data,
 * web_app, login_url, copy_text…) carries a label; only a url is a target
 * worth keeping in text, the other kinds are bot internals.
 */
export interface RichMessageButtonNode {
    text: RichTextNode;
    url?: string;
}

/** Bot API 10.3 inline button: no `text` field, the label sits on the button */
export interface RichTextButton {
    type: 'button';
    button: RichMessageButtonNode;
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
    | RichTextPassthrough
    | RichTextButton;

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
    /** Bot API 10.3; no markdown equivalent, ignored */
    is_compact?: true;
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

/** Bot API 10.3: a collapsed quote of inline text (no nested blocks) */
export interface RichBlockExpandableBlockQuotation {
    type: 'expandable_blockquote';
    text: RichTextNode;
    credit?: RichTextNode;
}

/** Bot API 10.3: an attached file; only the name matters for text */
export interface RichBlockDocument {
    type: 'document';
    document: { file_name?: string; mime_type?: string };
    caption?: RichBlockCaption;
}

/** Bot API 10.3: a row of buttons inside the message body */
export interface RichBlockButtons {
    type: 'buttons';
    buttons: RichMessageButtonNode[];
    align?: 'left' | 'center' | 'right';
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
    | RichBlockThinking
    | RichBlockExpandableBlockQuotation
    | RichBlockDocument
    | RichBlockButtons;

/** Media-ish block kinds a placeholder is emitted for */
export type RichMediaKind = RichBlockMedia['type'] | 'document' | 'map';

/** Extra facts about a media block, for custom placeholders */
export interface RichMediaDetails {
    /** document only: the file name, when the sender's client kept one */
    fileName?: string;
}

export interface RichBlocksToMarkdownOptions {
    /**
     * Custom placeholder for embedded media blocks. Receives the block kind,
     * its (already plain-text) caption and details such as a document's file
     * name; returns the text to emit. Two-parameter callbacks still fit.
     * Default: `[图片] caption` / `[文件] name caption` style placeholders.
     */
    mediaPlaceholder?: (kind: RichMediaKind, caption: string, details: RichMediaDetails) => string;
}
