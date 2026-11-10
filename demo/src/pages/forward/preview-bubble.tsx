interface PreviewBubbleProps {
  /** Complete HTML fragment from renderedToPreviewHtml; its styles are included */
  html: string;
}

/**
 * The Telegram-style bubble. The HTML is generated locally from the user's own
 * markdown (the library escapes every text run), never from pasted HTML.
 */
export const PreviewBubble = ({ html }: PreviewBubbleProps) => (
  <div className="fw-bubble" dangerouslySetInnerHTML={{ __html: html }} />
);
