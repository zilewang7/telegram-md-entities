import { useCallback } from 'react';
import type { ClientPlatform } from '../core/types';
import { useI18n } from '../i18n/i18n-context';
import type { MessageKey } from '../i18n/messages';
import { PLATFORM_LABEL_KEYS } from '../i18n/messages';
import { PLATFORM_OPTIONS } from '../lib/platform';
import type { PanelId } from './tab-switch';

interface PickerCopy {
  labelKey: MessageKey;
  hintKey: MessageKey;
}

/**
 * The same platform list means a different client in each panel: the paste
 * target in direction 1, the clipboard source in direction 2, the highlighted
 * row in the capability matrix.
 */
const PICKER_COPY: Readonly<Record<PanelId, PickerCopy>> = {
  forward: { labelKey: 'platform.target.label', hintKey: 'platform.target.hint' },
  reverse: { labelKey: 'platform.source.label', hintKey: 'platform.source.hint' },
  about: { labelKey: 'platform.client.label', hintKey: 'platform.client.hint' },
};

interface PlatformPickerProps {
  value: ClientPlatform;
  /** The active panel decides what the picked client is used for */
  panel: PanelId;
  onChange: (value: ClientPlatform) => void;
}

/**
 * Which Telegram client the user is dealing with. A plain browser cannot read
 * the Telegram app version, so the choice is explicit (and it makes the
 * per-client differences visible instead of hidden).
 */
export const PlatformPicker = ({ value, panel, onChange }: PlatformPickerProps) => {
  const { t } = useI18n();
  const copy = PICKER_COPY[panel];
  const label = t(copy.labelKey);
  const handleSelect = useCallback(
    (next: ClientPlatform) => () => onChange(next),
    [onChange],
  );

  return (
    <section className="platform-bar" aria-label={label}>
      <div className="field-label-row">
        <span className="field-label">{label}</span>
        <span className="hint">{t(copy.hintKey)}</span>
      </div>
      <div className="platform-chips" role="group" aria-label={label}>
        {PLATFORM_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className="platform-chip"
            aria-pressed={option === value}
            onClick={handleSelect(option)}
          >
            {t(PLATFORM_LABEL_KEYS[option])}
          </button>
        ))}
      </div>
    </section>
  );
};
