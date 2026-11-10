import { useCallback } from 'react';
import type { ClientPlatform } from '../core/types';
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
  const handleSelect = useCallback(
    (next: ClientPlatform) => () => onChange(next),
    [onChange],
  );

  return (
    <section className="platform-bar" aria-label="目标客户端">
      <div className="field-label-row">
        <span className="field-label">目标客户端</span>
        <span className="hint">选你打算把内容粘贴进去的那个客户端</span>
      </div>
      <div className="platform-chips" role="group">
        {PLATFORM_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="platform-chip"
            aria-pressed={option.value === value}
            onClick={handleSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
};
