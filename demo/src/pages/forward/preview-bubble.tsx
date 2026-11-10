import { useRef } from 'react';
import { useI18n } from '../../i18n/i18n-context';
import { usePreviewQuotes } from './use-preview-quotes';

interface PreviewBubbleProps {
  /** Complete HTML fragment from renderedToPreviewHtml; its styles are included */
  html: string;
}

/**
 * The Telegram-style bubble. The HTML is generated locally from the user's own
 * markdown (the library escapes every text run), never from pasted HTML.
 */
export const PreviewBubble = ({ html }: PreviewBubbleProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();
  usePreviewQuotes(containerRef, html, t('forward.quote.expand'), t('forward.quote.collapse'));
  return <div className="fw-bubble" ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
};
