import { useCallback } from 'react';
import type { ClientPlatform } from '../core/types';
import { useI18n } from '../i18n/i18n-context';
import { PLATFORM_LABEL_KEYS } from '../i18n/messages';
import { PLATFORM_OPTIONS } from '../lib/platform';

interface PlatformPickerProps {
  value: ClientPlatform;
  onChange: (value: ClientPlatform) => void;
}

/**
 * Which Telegram client the user will paste into. A plain browser cannot read
 * the Telegram app version, so the choice is explicit (and it makes the
 * per-client differences visible instead of hidden).
 */
export const PlatformPicker = ({ value, onChange }: PlatformPickerProps) => {
  const { t } = useI18n();
  const handleSelect = useCallback(
    (next: ClientPlatform) => () => onChange(next),
    [onChange],
  );

  return (
    <section className="platform-bar" aria-label={t('platform.groupLabel')}>
      <div className="field-label-row">
        <span className="field-label">{t('platform.label')}</span>
        <span className="hint">{t('platform.hint')}</span>
      </div>
      <div className="platform-chips" role="group" aria-label={t('platform.groupLabel')}>
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
