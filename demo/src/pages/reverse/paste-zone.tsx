import { useCallback } from 'react';
import type { ClipboardEvent } from 'react';

interface PasteZoneProps {
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** null when this browser cannot read the clipboard directly */
  onReadClipboard: (() => void) | null;
  reading: boolean;
}

const PLACEHOLDER =
  '在 Telegram 里复制一条带格式的消息，再点这里粘贴\n（电脑 Ctrl / ⌘ + V，手机上长按输入框选「粘贴」）';

/**
 * The paste target. A textarea (not a div) so mobile long-press paste works;
 * the handler reads the flavors and clears the field, nothing is kept.
 */
export const PasteZone = ({ onPaste, onReadClipboard, reading }: PasteZoneProps) => {
  const handleRead = useCallback(() => {
    onReadClipboard?.();
  }, [onReadClipboard]);

  return (
    <div className="rv-paste">
      <textarea
        className="field rv-paste-input"
        rows={5}
        aria-label="粘贴 Telegram 消息"
        placeholder={PLACEHOLDER}
        onPaste={onPaste}
      />
      {onReadClipboard !== null ? (
        <div className="rv-actions">
          <button type="button" className="button secondary" disabled={reading} onClick={handleRead}>
            {reading ? '读取中…' : '从剪贴板读取'}
          </button>
        </div>
      ) : (
        <p className="hint">当前浏览器不支持直接读取剪贴板，请用上面的粘贴方式。</p>
      )}
    </div>
  );
};
