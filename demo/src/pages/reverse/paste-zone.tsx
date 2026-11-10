import { useCallback } from 'react';
import type { ClipboardEvent } from 'react';
import { useI18n } from '../../i18n/i18n-context';

interface PasteZoneProps {
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** null when this browser cannot read the clipboard directly */
  onReadClipboard: (() => void) | null;
  reading: boolean;
}

/**
 * The paste target. A textarea (not a div) so mobile long-press paste works;
 * the handler reads the flavors and clears the field, nothing is kept.
 */
export const PasteZone = ({ onPaste, onReadClipboard, reading }: PasteZoneProps) => {
  const { t } = useI18n();

  const handleRead = useCallback(() => {
    onReadClipboard?.();
  }, [onReadClipboard]);

  return (
    <div className="rv-paste">
      <textarea
        className="field rv-paste-input"
        rows={5}
        aria-label={t('reverse.paste.ariaLabel')}
        placeholder={t('reverse.paste.placeholder')}
        onPaste={onPaste}
      />
      {onReadClipboard !== null ? (
        <div className="rv-actions">
          <button type="button" className="button secondary" disabled={reading} onClick={handleRead}>
            {reading ? t('reverse.paste.reading') : t('reverse.paste.read')}
          </button>
        </div>
      ) : (
        <p className="hint">{t('reverse.paste.noRead')}</p>
      )}
    </div>
  );
};
