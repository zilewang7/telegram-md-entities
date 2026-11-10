import { useCallback } from 'react';

export type PanelId = 'forward' | 'reverse' | 'about';

interface TabOption {
  value: PanelId;
  label: string;
  shortLabel: string;
}

const OPTIONS: readonly TabOption[] = [
  { value: 'forward', label: 'Markdown → Telegram', shortLabel: '→ Telegram' },
  { value: 'reverse', label: 'Telegram → Markdown', shortLabel: '→ Markdown' },
  { value: 'about', label: '了解更多', shortLabel: '了解更多' },
];

interface TabButtonProps {
  option: TabOption;
  selected: boolean;
  onSelect: (value: PanelId) => void;
}

const TabButton = ({ option, selected, onSelect }: TabButtonProps) => {
  const handleClick = useCallback(() => onSelect(option.value), [onSelect, option.value]);
  return (
    <button type="button" role="tab" aria-selected={selected} className="segment" onClick={handleClick}>
      <span className="tab-label-full">{option.label}</span>
      <span className="tab-label-short">{option.shortLabel}</span>
    </button>
  );
};

interface TabSwitchProps {
  value: PanelId;
  onChange: (value: PanelId) => void;
}

/** The three panels, as a Telegram-style segmented control */
export const TabSwitch = ({ value, onChange }: TabSwitchProps) => (
  <div className="segment-control app-tabs" role="tablist" aria-label="功能">
    {OPTIONS.map((option) => (
      <TabButton key={option.value} option={option} selected={option.value === value} onSelect={onChange} />
    ))}
  </div>
);
