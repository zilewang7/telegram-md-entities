import { useCallback } from 'react';
import type { ChangeEvent, ClipboardEvent } from 'react';
import { useI18n } from '../../i18n/i18n-context';

interface PasteZoneProps {
  /** The box is controlled so typed text and paste results cannot drift apart */
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** null when this browser cannot read the clipboard directly */
  onReadClipboard: (() => void) | null;
  reading: boolean;
}

/**
 * The paste target. A textarea (not a div) so mobile long-press paste works;
 * the paste handler reads the clipboard flavors and clears the field. Text
 * typed by hand goes through onChange and is treated as plain input.
 */
export const PasteZone = ({ value, onChange, onPaste, onReadClipboard, reading }: PasteZoneProps) => {
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
        value={value}
        onChange={onChange}
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
