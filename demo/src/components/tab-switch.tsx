import { useCallback } from 'react';
import { useI18n } from '../i18n/i18n-context';
import type { MessageKey } from '../i18n/messages';

export type PanelId = 'forward' | 'reverse' | 'about';

interface TabCopy {
  value: PanelId;
  label: MessageKey;
  shortLabel: MessageKey;
}

const OPTIONS: readonly TabCopy[] = [
  { value: 'forward', label: 'tab.forward', shortLabel: 'tab.forward.short' },
  { value: 'reverse', label: 'tab.reverse', shortLabel: 'tab.reverse.short' },
  { value: 'about', label: 'tab.about', shortLabel: 'tab.about.short' },
];

interface TabButtonProps {
  option: TabCopy;
  selected: boolean;
  onSelect: (value: PanelId) => void;
}

const TabButton = ({ option, selected, onSelect }: TabButtonProps) => {
  const { t } = useI18n();
  const handleClick = useCallback(() => onSelect(option.value), [onSelect, option.value]);
  return (
    <button type="button" role="tab" aria-selected={selected} className="segment" onClick={handleClick}>
      <span className="tab-label-full">{t(option.label)}</span>
      <span className="tab-label-short">{t(option.shortLabel)}</span>
    </button>
  );
};

interface TabSwitchProps {
  value: PanelId;
  onChange: (value: PanelId) => void;
}

/** The three panels, as a Telegram-style segmented control */
export const TabSwitch = ({ value, onChange }: TabSwitchProps) => {
  const { t } = useI18n();
  return (
    <div className="segment-control app-tabs" role="tablist" aria-label={t('tabs.label')}>
      {OPTIONS.map((option) => (
        <TabButton key={option.value} option={option} selected={option.value === value} onSelect={onChange} />
      ))}
    </div>
  );
};
